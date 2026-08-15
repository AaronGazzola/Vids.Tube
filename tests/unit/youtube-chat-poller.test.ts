import type { YouTubeChatPage } from "@/app/layout.types";
import { YouTubeApiError } from "@/lib/youtube";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The poller waits at least a second between pages and backs off to a minute
// after repeated failure. Under real timers this suite would spend most of a
// minute asleep, so time is driven by hand instead.
vi.mock("@/lib/youtube", async () => {
  const actual = await vi.importActual<typeof import("@/lib/youtube")>("@/lib/youtube");
  return { ...actual, fetchLiveChatPage: vi.fn() };
});
vi.mock("../../worker/config", () => ({
  workerConfig: { youtubeChatPollMs: 0 },
}));

const { fetchLiveChatPage } = await import("@/lib/youtube");
const { isChatEnded, pollYoutubeChat } = await import("../../worker/lib/youtube-chat");

const mockFetch = vi.mocked(fetchLiveChatPage);

const page = (
  texts: string[],
  nextPageToken: string | null = "next"
): YouTubeChatPage => ({
  messages: texts.map((text, i) => ({
    id: `${text}-${i}`,
    author: "viewer",
    authorChannelId: "UCviewer",
    avatarUrl: "",
    text,
    publishedAt: "2026-08-15T00:00:00Z",
  })),
  nextPageToken,
  pollingIntervalMillis: 0,
});

// Drives the clock forward until the poller finishes, so a test never waits on
// a real sleep. The cap is a runaway guard: a poller that never returns is the
// exact bug this suite exists to catch, and it must fail rather than hang.
async function runWithClock<T>(work: Promise<T>): Promise<T> {
  let settled = false;
  const tracked = work.finally(() => {
    settled = true;
  });
  for (let i = 0; i < 500 && !settled; i += 1) {
    await vi.advanceTimersByTimeAsync(1_000);
  }
  if (!settled) throw new Error("poller did not return");
  return tracked;
}

// Collects at most `limit` messages, then stops the poller the way the scoring
// job does, so no test depends on the loop ending by itself.
function collect(limit: number, extra?: () => boolean): Promise<string[]> {
  const out: string[] = [];
  let stop = false;
  const run = async () => {
    for await (const m of pollYoutubeChat("chat-1", {
      shouldStop: () => stop || (extra?.() ?? false),
    })) {
      out.push(m.text);
      if (out.length >= limit) stop = true;
    }
    return out;
  };
  return runWithClock(run());
}

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("isChatEnded", () => {
  it("is true for a 404", () => {
    expect(isChatEnded(new YouTubeApiError("gone", 404, null))).toBe(true);
  });

  it("is true for the reasons YouTube gives when chat is over", () => {
    expect(isChatEnded(new YouTubeApiError("x", 403, "liveChatEnded"))).toBe(true);
    expect(isChatEnded(new YouTubeApiError("x", 403, "liveChatNotFound"))).toBe(true);
  });

  it("is false for a server error, which is worth retrying", () => {
    expect(isChatEnded(new YouTubeApiError("x", 500, "backendError"))).toBe(false);
  });

  it("is false for quota, which is transient even though retries will not help today", () => {
    expect(isChatEnded(new YouTubeApiError("x", 403, "quotaExceeded"))).toBe(false);
  });

  it("is false for anything that is not a YouTube error", () => {
    expect(isChatEnded(new Error("fetch failed"))).toBe(false);
    expect(isChatEnded(null)).toBe(false);
  });
});

describe("pollYoutubeChat", () => {
  it("yields nothing without a chat id", async () => {
    const out: string[] = [];
    for await (const m of pollYoutubeChat(null, { shouldStop: () => false })) {
      out.push(m.text);
    }
    expect(out).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("advances by the next page token", async () => {
    mockFetch
      .mockResolvedValueOnce(page(["a"], "token-2"))
      .mockResolvedValueOnce(page(["b"], "token-3"));
    expect(await collect(2)).toEqual(["a", "b"]);
    expect(mockFetch.mock.calls[0][1]).toBeUndefined();
    expect(mockFetch.mock.calls[1][1]).toBe("token-2");
  });

  it("retries a failed read with the token it already held", async () => {
    mockFetch
      .mockResolvedValueOnce(page(["a"], "token-2"))
      .mockRejectedValueOnce(new YouTubeApiError("boom", 503, "backendError"))
      .mockResolvedValueOnce(page(["b"], "token-3"));
    expect(await collect(2)).toEqual(["a", "b"]);
    // The retry asks for the same page. A fresh request with no token would
    // return only recent messages and drop the outage entirely.
    expect(mockFetch.mock.calls[1][1]).toBe("token-2");
    expect(mockFetch.mock.calls[2][1]).toBe("token-2");
  });

  it("keeps polling when a page carries no next token", async () => {
    mockFetch
      .mockResolvedValueOnce(page(["a"], "token-2"))
      .mockResolvedValueOnce(page([], null))
      .mockResolvedValueOnce(page(["b"], "token-3"));
    expect(await collect(2)).toEqual(["a", "b"]);
    // The token is unchanged across the tokenless page, rather than the poller
    // treating its absence as the end of chat.
    expect(mockFetch.mock.calls[2][1]).toBe("token-2");
  });

  it("returns when the chat has ended", async () => {
    mockFetch
      .mockResolvedValueOnce(page(["a"], "token-2"))
      .mockRejectedValueOnce(new YouTubeApiError("over", 403, "liveChatEnded"));
    const out: string[] = [];
    await runWithClock(
      (async () => {
        for await (const m of pollYoutubeChat("chat-1", { shouldStop: () => false })) {
          out.push(m.text);
        }
      })()
    );
    expect(out).toEqual(["a"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("returns when told to stop while waiting, with no message to wake it", async () => {
    // A silent chat yields nothing, so a stop checked only on a message would
    // never be seen and the worker would hold the broadcast open forever.
    let reads = 0;
    mockFetch.mockImplementation(async () => {
      reads += 1;
      return page([], "token-2");
    });
    const out = await collect(1, () => reads >= 3);
    expect(out).toEqual([]);
    expect(reads).toBe(3);
  });

  it("doubles the wait while reads keep failing, and resets after one succeeds", async () => {
    const at: number[] = [];
    const outcomes = [
      () => Promise.reject(new YouTubeApiError("a", 500, "backendError")),
      () => Promise.reject(new YouTubeApiError("b", 500, "backendError")),
      () => Promise.resolve(page(["a"], "token-2")),
      () => Promise.reject(new YouTubeApiError("c", 500, "backendError")),
      () => Promise.resolve(page(["b"], "token-3")),
    ];
    mockFetch.mockImplementation(() => {
      at.push(Date.now());
      return (outcomes.shift() ?? (() => Promise.resolve(page([], "token-4"))))();
    });

    expect(await collect(2)).toEqual(["a", "b"]);

    const gaps = at.slice(1).map((t, i) => t - at[i]);
    // 2s after the first failure, doubled to 4s after the second, then the
    // ordinary 1s between pages once a read succeeds, and back to 2s for the
    // next failure rather than continuing to climb.
    expect(gaps).toEqual([2_000, 4_000, 1_000, 2_000]);
  });

  it("gives up retrying only on a terminal error, however many transient ones come first", async () => {
    mockFetch
      .mockRejectedValueOnce(new YouTubeApiError("a", 500, "backendError"))
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(page(["survived"], "token-2"));
    expect(await collect(1)).toEqual(["survived"]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

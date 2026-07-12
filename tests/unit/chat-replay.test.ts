import { describe, expect, it } from "vitest";
import { toReplayMessages, visibleReplayMessages } from "@/lib/chat-replay";
import type { ChatReplay, ChatReplayRow, ReplayGap } from "@/app/watch/[videoId]/page.types";

const startedAt = "2026-06-01T00:00:00.000Z";

function replay(
  partial: Partial<ChatReplay> & { messages: ChatReplayRow[] }
): ChatReplay {
  return { startedAt, liveAt: null, gaps: [], ...partial };
}

function gap(startSeconds: number, endSeconds: number | null): ReplayGap {
  const base = new Date(startedAt).getTime();
  return {
    startAt: new Date(base + startSeconds * 1000).toISOString(),
    endAt: endSeconds == null ? null : new Date(base + endSeconds * 1000).toISOString(),
  };
}

function row(id: string, secondsAfterStart: number, body = id) {
  return {
    id,
    user_id: `user-${id}`,
    origin: "vidstube",
    author: { handle: id, avatarPath: null },
    author_name: null,
    author_avatar_url: null,
    body,
    created_at: new Date(
      new Date(startedAt).getTime() + secondsAfterStart * 1000
    ).toISOString(),
  };
}

function youtubeRow(id: string, secondsAfterStart: number, body = id) {
  return {
    id,
    user_id: null,
    origin: "youtube",
    author: null,
    author_name: `yt-${id}`,
    author_avatar_url: null,
    body,
    created_at: new Date(
      new Date(startedAt).getTime() + secondsAfterStart * 1000
    ).toISOString(),
  };
}

describe("toReplayMessages", () => {
  it("computes offsets relative to the stream start", () => {
    const data = replay({
      messages: [row("a", 0), row("b", 5), row("c", 42)],
    });
    const result = toReplayMessages(data);
    expect(result.map((m) => m.offsetMs)).toEqual([0, 5_000, 42_000]);
    expect(result[0].userId).toBe("user-a");
    expect(result[0].author).toEqual({ handle: "a", avatarPath: null });
  });

  it("carries origin and youtube author fields through for both origins", () => {
    const data = replay({
      messages: [row("vt", 0), youtubeRow("yt", 5)],
    });
    const result = toReplayMessages(data);
    expect(result[0].origin).toBe("vidstube");
    expect(result[1].origin).toBe("youtube");
    expect(result[1].userId).toBeNull();
    expect(result[1].author).toBeNull();
    expect(result[1].author_name).toBe("yt-yt");
  });

  it("clamps messages before the stream start to offset 0", () => {
    const data = replay({
      messages: [row("early", -10), row("later", 3)],
    });
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([0, 3_000]);
  });

  it("falls back to the earliest message when startedAt is null", () => {
    const data = replay({
      startedAt: null,
      messages: [row("a", 100), row("b", 130)],
    });
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([0, 30_000]);
  });

  it("returns an empty array when there are no messages", () => {
    expect(toReplayMessages(replay({ messages: [] }))).toEqual([]);
  });

  it("anchors offsets to live_at (the VOD start), not started_at", () => {
    const data = replay({
      liveAt: new Date(new Date(startedAt).getTime() + 30_000).toISOString(),
      messages: [row("a", 30), row("b", 45)],
    });
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([0, 15_000]);
  });

  it("removes reconnect gaps: before, inside (clamped to the cut), and after", () => {
    const data = replay({
      liveAt: startedAt,
      gaps: [gap(10, 40)],
      messages: [row("before", 5), row("inside", 20), row("after", 50)],
    });
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([
      5_000,
      10_000,
      20_000,
    ]);
  });

  it("ignores gaps when live_at is unknown (legacy VOD)", () => {
    const data = replay({
      gaps: [gap(10, 40)],
      messages: [row("after", 50)],
    });
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([50_000]);
  });
});

describe("visibleReplayMessages", () => {
  const messages = toReplayMessages(
    replay({ messages: [row("a", 0), row("b", 5), row("c", 10)] })
  );

  it("shows only messages at or before the current time", () => {
    expect(visibleReplayMessages(messages, 5_000).map((m) => m.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("re-filters to fewer messages when the playhead seeks backward", () => {
    expect(visibleReplayMessages(messages, 0).map((m) => m.id)).toEqual(["a"]);
  });

  it("shows all messages once the playhead passes the last offset", () => {
    expect(visibleReplayMessages(messages, 999_000)).toHaveLength(3);
  });
});

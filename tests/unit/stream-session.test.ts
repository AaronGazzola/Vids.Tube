import { describe, expect, it } from "vitest";
import { decideGoLive, isLiveAndFresh, STALE_MS } from "@/lib/stream";

const now = new Date("2026-06-07T00:00:00.000Z").getTime();

function row(
  status: string,
  secondsSinceLastSeen: number | null,
  id = "stream-1"
) {
  return {
    id,
    status,
    last_seen_at:
      secondsSinceLastSeen === null
        ? null
        : new Date(now - secondsSinceLastSeen * 1000).toISOString(),
  };
}

describe("isLiveAndFresh", () => {
  it("is true for a live row seen within the staleness window", () => {
    expect(isLiveAndFresh(row("live", 10), now)).toBe(true);
  });

  it("is false for a live row older than the staleness window", () => {
    expect(isLiveAndFresh(row("live", STALE_MS / 1000 + 5), now)).toBe(false);
  });

  it("is false for a non-live row even when recently seen", () => {
    expect(isLiveAndFresh(row("ended", 1), now)).toBe(false);
  });

  it("is false for a live row that has never been seen", () => {
    expect(isLiveAndFresh(row("live", null), now)).toBe(false);
  });
});

describe("decideGoLive", () => {
  it("starts a new session when no stream row exists", () => {
    expect(decideGoLive(null, now)).toEqual({ action: "new" });
  });

  it("reconnects to an ongoing live session", () => {
    expect(decideGoLive(row("live", 5, "s-live"), now)).toEqual({
      action: "reconnect",
      streamId: "s-live",
    });
  });

  it("starts a new session after a prior session ended", () => {
    expect(decideGoLive(row("ended", 5), now)).toEqual({ action: "new" });
  });

  it("starts a new session when the latest row is idle", () => {
    expect(decideGoLive(row("idle", 5), now)).toEqual({ action: "new" });
  });

  it("ends the orphan and starts a new session after a stale live row", () => {
    expect(decideGoLive(row("live", STALE_MS / 1000 + 30, "s-stale"), now)).toEqual(
      { action: "new-after-stale", staleStreamId: "s-stale" }
    );
  });
});

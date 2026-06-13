import { describe, expect, it } from "vitest";
import {
  decideGoLive,
  isClaimableScheduled,
  isLiveAndFresh,
  isOngoingAndFresh,
  SCHEDULED_CLAIM_GRACE_MS,
  STALE_MS,
} from "@/lib/stream";

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

function scheduledRow(secondsFromNow: number, id = "sched-1") {
  return {
    id,
    status: "scheduled",
    scheduled_start_at: new Date(now + secondsFromNow * 1000).toISOString(),
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

  it("is false for a fresh preview row (preview is not publicly live)", () => {
    expect(isLiveAndFresh(row("preview", 5), now)).toBe(false);
  });
});

describe("isOngoingAndFresh", () => {
  it("is true for a fresh live row", () => {
    expect(isOngoingAndFresh(row("live", 5), now)).toBe(true);
  });

  it("is true for a fresh preview row", () => {
    expect(isOngoingAndFresh(row("preview", 5), now)).toBe(true);
  });

  it("is false for a stale preview row", () => {
    expect(isOngoingAndFresh(row("preview", STALE_MS / 1000 + 5), now)).toBe(
      false
    );
  });

  it("is false for an ended row", () => {
    expect(isOngoingAndFresh(row("ended", 1), now)).toBe(false);
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

  it("reconnects to an ongoing preview session", () => {
    expect(decideGoLive(row("preview", 5, "s-prev"), now)).toEqual({
      action: "reconnect",
      streamId: "s-prev",
    });
  });

  it("ends the orphan and starts a new session after a stale preview row", () => {
    expect(
      decideGoLive(row("preview", STALE_MS / 1000 + 30, "s-stale-prev"), now)
    ).toEqual({ action: "new-after-stale", staleStreamId: "s-stale-prev" });
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

  it("claims a claimable scheduled broadcast when there is no ongoing session", () => {
    expect(
      decideGoLive(null, now, scheduledRow(3600, "s-sched"))
    ).toEqual({ action: "claim-scheduled", streamId: "s-sched" });
  });

  it("claims the scheduled broadcast over a prior ended row", () => {
    expect(
      decideGoLive(row("ended", 5), now, scheduledRow(3600, "s-sched"))
    ).toEqual({ action: "claim-scheduled", streamId: "s-sched" });
  });

  it("prefers reconnecting to an ongoing session over claiming a scheduled broadcast", () => {
    expect(
      decideGoLive(row("live", 5, "s-live"), now, scheduledRow(3600, "s-sched"))
    ).toEqual({ action: "reconnect", streamId: "s-live" });
  });

  it("does not claim a missed scheduled broadcast (past the grace window)", () => {
    const missed = scheduledRow(
      -(SCHEDULED_CLAIM_GRACE_MS / 1000) - 3600,
      "s-missed"
    );
    expect(decideGoLive(null, now, missed)).toEqual({ action: "new" });
  });

  it("claims a scheduled broadcast started within the grace window", () => {
    const recentlyStarted = scheduledRow(-600, "s-late");
    expect(decideGoLive(null, now, recentlyStarted)).toEqual({
      action: "claim-scheduled",
      streamId: "s-late",
    });
  });
});

describe("isClaimableScheduled", () => {
  it("is true for a future scheduled row", () => {
    expect(isClaimableScheduled(scheduledRow(3600), now)).toBe(true);
  });

  it("is true within the grace window after start", () => {
    expect(
      isClaimableScheduled(scheduledRow(-(SCHEDULED_CLAIM_GRACE_MS / 1000) + 60), now)
    ).toBe(true);
  });

  it("is false once past the grace window", () => {
    expect(
      isClaimableScheduled(scheduledRow(-(SCHEDULED_CLAIM_GRACE_MS / 1000) - 60), now)
    ).toBe(false);
  });

  it("is false for a non-scheduled row", () => {
    expect(
      isClaimableScheduled(
        { status: "preview", scheduled_start_at: null },
        now
      )
    ).toBe(false);
  });

  it("is false for null", () => {
    expect(isClaimableScheduled(null, now)).toBe(false);
  });
});

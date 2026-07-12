import { describe, expect, it } from "vitest";
import {
  decideGoLive,
  isClaimableScheduled,
  isLiveAndFresh,
  isOngoingAndFresh,
  isStreamPublic,
  previewRevertTarget,
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
  it("starts a new ad-hoc session when no active row exists", () => {
    expect(decideGoLive(null)).toEqual({ action: "new" });
  });

  it("reconnects to an existing live row", () => {
    expect(decideGoLive({ id: "s-live", status: "live" })).toEqual({
      action: "reconnect",
      streamId: "s-live",
    });
  });

  it("reconnects to an existing preview row (fresh or stale)", () => {
    expect(decideGoLive({ id: "s-prev", status: "preview" })).toEqual({
      action: "reconnect",
      streamId: "s-prev",
    });
  });

  it("claims a draft row created in the UI", () => {
    expect(decideGoLive({ id: "s-draft", status: "draft" })).toEqual({
      action: "claim",
      streamId: "s-draft",
    });
  });

  it("claims a scheduled row created in the UI", () => {
    expect(decideGoLive({ id: "s-sched", status: "scheduled" })).toEqual({
      action: "claim",
      streamId: "s-sched",
    });
  });

  it("starts a new session for an ended row", () => {
    expect(decideGoLive({ id: "s-ended", status: "ended" })).toEqual({
      action: "new",
    });
  });

  it("starts a new session for an idle row", () => {
    expect(decideGoLive({ id: "s-idle", status: "idle" })).toEqual({
      action: "new",
    });
  });
});

describe("isStreamPublic", () => {
  it("is true for a live stream regardless of schedule", () => {
    expect(isStreamPublic({ status: "live", scheduled_start_at: null })).toBe(
      true
    );
  });

  it("is true for a dated scheduled or preview stream", () => {
    const at = new Date(now).toISOString();
    expect(
      isStreamPublic({ status: "scheduled", scheduled_start_at: at })
    ).toBe(true);
    expect(isStreamPublic({ status: "preview", scheduled_start_at: at })).toBe(
      true
    );
  });

  it("is false for a draft and for an ad-hoc (undated) preview", () => {
    expect(isStreamPublic({ status: "draft", scheduled_start_at: null })).toBe(
      false
    );
    expect(
      isStreamPublic({ status: "preview", scheduled_start_at: null })
    ).toBe(false);
  });
});

describe("previewRevertTarget", () => {
  it("reverts a dated preview to scheduled", () => {
    expect(
      previewRevertTarget({
        scheduled_start_at: new Date(now).toISOString(),
        created_in_ui: true,
      })
    ).toBe("scheduled");
  });

  it("reverts an undated UI-created preview to draft", () => {
    expect(
      previewRevertTarget({ scheduled_start_at: null, created_in_ui: true })
    ).toBe("draft");
  });

  it("deletes an ad-hoc preview", () => {
    expect(
      previewRevertTarget({ scheduled_start_at: null, created_in_ui: false })
    ).toBe("delete");
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

export const STALE_MS = 60_000;

export const SCHEDULED_CLAIM_GRACE_MS = 6 * 60 * 60 * 1000;

export type StreamSessionRow = {
  id: string;
  status: string;
  last_seen_at: string | null;
};

export type ScheduledRow = {
  id: string;
  status: string;
  scheduled_start_at: string | null;
};

export type PublicVisibilityRow = {
  status: string;
  scheduled_start_at: string | null;
};

export type PreviewOriginRow = {
  scheduled_start_at: string | null;
  created_in_ui: boolean;
};

export type ActiveStreamRow = {
  id: string;
  status: string;
};

export type GoLiveDecision =
  | { action: "reconnect"; streamId: string }
  | { action: "claim"; streamId: string }
  | { action: "new" };

export type PreviewRevertTarget = "scheduled" | "draft" | "delete";

export function isLiveAndFresh(
  row: Pick<StreamSessionRow, "status" | "last_seen_at">,
  nowMs: number,
  staleMs: number = STALE_MS
): boolean {
  if (row.status !== "live") {
    return false;
  }
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  return nowMs - lastSeen <= staleMs;
}

// A live broadcast whose feed has gone stale: the encoder is disconnected but the
// broadcast is not ended. The player shows a "Disconnected" state and chat stays
// open until the owner ends it.
export function isFeedDisconnected(
  row: Pick<StreamSessionRow, "status" | "last_seen_at">,
  nowMs: number = Date.now(),
  staleMs: number = STALE_MS
): boolean {
  return row.status === "live" && !isLiveAndFresh(row, nowMs, staleMs);
}

export function isOngoingAndFresh(
  row: Pick<StreamSessionRow, "status" | "last_seen_at">,
  nowMs: number,
  staleMs: number = STALE_MS
): boolean {
  if (row.status !== "live" && row.status !== "preview") {
    return false;
  }
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
  return nowMs - lastSeen <= staleMs;
}

export function isClaimableScheduled(
  row: Pick<ScheduledRow, "status" | "scheduled_start_at"> | null,
  nowMs: number,
  graceMs: number = SCHEDULED_CLAIM_GRACE_MS
): boolean {
  if (!row || row.status !== "scheduled") {
    return false;
  }
  if (!row.scheduled_start_at) {
    return true;
  }
  const startMs = new Date(row.scheduled_start_at).getTime();
  return nowMs - startMs <= graceMs;
}

// Single source of truth for what a viewer/anonymous visitor may see. A dated
// broadcast is public from the moment it is scheduled (waiting room) through
// preview; an undated draft or an ad-hoc preview stays private until go-live.
export function isStreamPublic(row: PublicVisibilityRow): boolean {
  if (row.status === "live") {
    return true;
  }
  return (
    row.scheduled_start_at != null &&
    (row.status === "scheduled" || row.status === "preview")
  );
}

// Where a preview row returns to when the encoder disconnects before go-live.
export function previewRevertTarget(row: PreviewOriginRow): PreviewRevertTarget {
  if (row.scheduled_start_at != null) {
    return "scheduled";
  }
  if (row.created_in_ui) {
    return "draft";
  }
  return "delete";
}

// The channel has at most one active stream. Given that row (or null), decide
// what the encoder connect should do:
//   - preview/live already connected -> reconnect (refresh feed fields)
//   - draft/scheduled created in the UI -> claim it into preview
//   - nothing active -> create an ad-hoc preview
export function decideGoLive(active: ActiveStreamRow | null): GoLiveDecision {
  if (!active) {
    return { action: "new" };
  }
  if (active.status === "preview" || active.status === "live") {
    return { action: "reconnect", streamId: active.id };
  }
  if (active.status === "draft" || active.status === "scheduled") {
    return { action: "claim", streamId: active.id };
  }
  return { action: "new" };
}

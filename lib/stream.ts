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

export type GoLiveDecision =
  | { action: "reconnect"; streamId: string }
  | { action: "claim-scheduled"; streamId: string }
  | { action: "new" }
  | { action: "new-after-stale"; staleStreamId: string };

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

export function decideGoLive(
  existing: StreamSessionRow | null,
  nowMs: number,
  scheduled: ScheduledRow | null = null,
  staleMs: number = STALE_MS
): GoLiveDecision {
  if (existing && isOngoingAndFresh(existing, nowMs, staleMs)) {
    return { action: "reconnect", streamId: existing.id };
  }
  if (isClaimableScheduled(scheduled, nowMs)) {
    return { action: "claim-scheduled", streamId: scheduled!.id };
  }
  if (
    existing &&
    (existing.status === "live" || existing.status === "preview")
  ) {
    return { action: "new-after-stale", staleStreamId: existing.id };
  }
  return { action: "new" };
}

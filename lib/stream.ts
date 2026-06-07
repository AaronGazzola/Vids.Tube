export const STALE_MS = 60_000;

export type StreamSessionRow = {
  id: string;
  status: string;
  last_seen_at: string | null;
};

export type GoLiveDecision =
  | { action: "reconnect"; streamId: string }
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

export function decideGoLive(
  existing: StreamSessionRow | null,
  nowMs: number,
  staleMs: number = STALE_MS
): GoLiveDecision {
  if (!existing) {
    return { action: "new" };
  }
  if (isLiveAndFresh(existing, nowMs, staleMs)) {
    return { action: "reconnect", streamId: existing.id };
  }
  if (existing.status === "live") {
    return { action: "new-after-stale", staleStreamId: existing.id };
  }
  return { action: "new" };
}

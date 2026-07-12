// A worker heartbeat older than this is treated as "worker stopped". The worker
// ticks every ~10s, so this covers a few missed ticks. Shared by the worker
// (which upserts the heartbeat) and the app (which reads freshness).
export const WORKER_HEARTBEAT_STALE_MS = 30_000;

export function isWorkerFresh(
  lastHeartbeatAt: string | null | undefined,
  nowMs: number = Date.now(),
  staleMs: number = WORKER_HEARTBEAT_STALE_MS
): boolean {
  if (!lastHeartbeatAt) {
    return false;
  }
  return nowMs - new Date(lastHeartbeatAt).getTime() <= staleMs;
}

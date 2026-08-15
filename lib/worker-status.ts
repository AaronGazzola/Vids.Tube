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

// A healthy YouTube chat reader stamps its broadcast at most every 15s, so three
// missed stamps is a stall. Deliberately narrower than the reader's 60s backoff
// ceiling: reads failing long enough to reach that ceiling are a stall, and
// showing them as one is the point.
export const CHAT_CAPTURE_STALE_MS = 45_000;

export function isChatCaptureFresh(
  lastPolledAt: string | null | undefined,
  nowMs: number = Date.now(),
  staleMs: number = CHAT_CAPTURE_STALE_MS
): boolean {
  if (!lastPolledAt) {
    return false;
  }
  return nowMs - new Date(lastPolledAt).getTime() <= staleMs;
}

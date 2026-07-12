import { isLiveAndFresh, isStreamPublic } from "@/lib/stream";
import { supabaseAdmin } from "../supabase";
import { workerConfig } from "../config";

export interface EligibleStream {
  id: string;
  status: string;
  startedAtMs: number;
}

// A stream the worker should engage: it is public (live, or a dated
// scheduled/preview waiting room). A `live` stream must also be fresh (encoder
// heartbeating); a scheduled/preview waiting room needs no encoder freshness.
function isEngageable(row: {
  status: string;
  scheduled_start_at: string | null;
  last_seen_at: string | null;
}): boolean {
  if (!isStreamPublic(row)) {
    return false;
  }
  if (row.status === "live") {
    return isLiveAndFresh(row, Date.now());
  }
  return true;
}

export async function resolveEligibleStream(): Promise<EligibleStream | null> {
  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, scheduled_start_at, last_seen_at, started_at")
    .in("status", ["scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to resolve engageable stream");
  }
  if (!stream || !isEngageable(stream)) {
    return null;
  }

  const { data: state, error: stateError } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("enabled")
    .eq("stream_id", stream.id)
    .maybeSingle();

  if (stateError) {
    console.error(stateError);
    throw new Error("Failed to read scoring state");
  }
  if (!state?.enabled) {
    return null;
  }

  return {
    id: stream.id,
    status: stream.status,
    startedAtMs: stream.started_at
      ? new Date(stream.started_at).getTime()
      : Date.now(),
  };
}

export async function isStreamEligible(streamId: string): Promise<boolean> {
  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("status, scheduled_start_at, last_seen_at")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream || !isEngageable(stream)) {
    return false;
  }
  const { data: state } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("enabled")
    .eq("stream_id", streamId)
    .maybeSingle();
  return !!state?.enabled;
}

let heartbeatChannelId: string | null = null;

async function resolveWorkerChannelId(): Promise<string | null> {
  if (heartbeatChannelId) {
    return heartbeatChannelId;
  }
  const { data, error } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", workerConfig.mtxPath)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  heartbeatChannelId = data?.id ?? null;
  return heartbeatChannelId;
}

// Upsert the worker heartbeat so the /live page can show a running indicator and
// schedule-save can warn when the worker is unreachable. Called every tick, even
// when no stream is eligible.
export async function upsertWorkerHeartbeat(): Promise<void> {
  const channelId = await resolveWorkerChannelId();
  if (!channelId) {
    return;
  }
  const { error } = await supabaseAdmin
    .from("worker_heartbeats")
    .upsert(
      { channel_id: channelId, last_heartbeat_at: new Date().toISOString() },
      { onConflict: "channel_id" }
    );
  if (error) {
    console.error(error);
  }
}

export async function tryAcquireLock(
  streamId: string,
  leaseMs: number
): Promise<boolean> {
  const nowMs = Date.now();
  const { data } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("locked_until")
    .eq("stream_id", streamId)
    .maybeSingle();

  if (data?.locked_until && new Date(data.locked_until).getTime() > nowMs) {
    return false;
  }

  const { error } = await supabaseAdmin
    .from("chat_scoring_state")
    .update({
      locked_until: new Date(nowMs + leaseMs).toISOString(),
      updated_at: new Date(nowMs).toISOString(),
    })
    .eq("stream_id", streamId);
  return !error;
}

export async function renewLock(
  streamId: string,
  leaseMs: number
): Promise<void> {
  await supabaseAdmin
    .from("chat_scoring_state")
    .update({ locked_until: new Date(Date.now() + leaseMs).toISOString() })
    .eq("stream_id", streamId);
}

export async function releaseLock(streamId: string): Promise<void> {
  await supabaseAdmin
    .from("chat_scoring_state")
    .update({ locked_until: null })
    .eq("stream_id", streamId);
}

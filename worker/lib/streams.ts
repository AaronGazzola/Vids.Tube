import { isLiveAndFresh } from "@/lib/stream";
import { supabaseAdmin } from "../supabase";

export interface EligibleStream {
  id: string;
  startedAtMs: number;
}

export async function resolveEligibleStream(): Promise<EligibleStream | null> {
  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, last_seen_at, started_at")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to resolve live stream");
  }
  if (!stream || !isLiveAndFresh(stream, Date.now())) {
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
    startedAtMs: stream.started_at
      ? new Date(stream.started_at).getTime()
      : Date.now(),
  };
}

export async function isStreamEligible(streamId: string): Promise<boolean> {
  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("status, last_seen_at")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream || !isLiveAndFresh(stream, Date.now())) {
    return false;
  }
  const { data: state } = await supabaseAdmin
    .from("chat_scoring_state")
    .select("enabled")
    .eq("stream_id", streamId)
    .maybeSingle();
  return !!state?.enabled;
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

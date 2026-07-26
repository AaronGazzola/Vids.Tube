import { runTranscriptionJob } from "../worker/jobs/transcribe";
import { supabaseAdmin } from "../worker/supabase";

const STREAM_ID = "f6dbc386-4215-4816-bb4d-22a64e3a1919";

async function main() {
  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, started_at")
    .eq("id", STREAM_ID)
    .maybeSingle();
  if (error || !stream) {
    console.error("failed to load stream:", error);
    process.exit(1);
  }
  if (stream.status !== "live") {
    console.error(`stream is ${stream.status}, not live — nothing to do`);
    process.exit(1);
  }
  const startedAtMs = stream.started_at
    ? new Date(stream.started_at).getTime()
    : Date.now();
  for (;;) {
    console.error(
      `[sidecar] starting live transcription for ${stream.id} (baseline from started_at ${stream.started_at})`
    );
    await runTranscriptionJob({
      id: stream.id,
      status: "live",
      startedAtMs,
    });
    const { data: check } = await supabaseAdmin
      .from("streams")
      .select("status")
      .eq("id", STREAM_ID)
      .maybeSingle();
    if (check?.status !== "live") {
      console.error(`[sidecar] stream is ${check?.status}; stopping`);
      break;
    }
    console.error("[sidecar] job returned while stream still live; restarting in 5s");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

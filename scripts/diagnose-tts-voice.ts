import { supabaseAdmin } from "../worker/supabase";

async function main() {
  const { data, error } = await supabaseAdmin
    .from("tts_requests")
    .update({ audio_path: null })
    .eq("stream_id", "56985144-1a61-4e24-8de0-bc9d1d703ddf")
    .not("audio_path", "is", null)
    .select("id, text");
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.error(`cleared audio_path on ${data?.length ?? 0} rows`);
}

main();

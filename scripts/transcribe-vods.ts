import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { vodAssetUrl } from "../lib/storage";
import type { Database } from "../supabase/types";
import { workerConfig } from "../worker/config";
import { exec } from "../worker/lib/exec";
import { loadWhisperSegments, transcribeWavToJson } from "../worker/lib/whisper";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);

const args = process.argv.slice(2);
const onlyId = args.includes("--video") ? args[args.indexOf("--video") + 1] : null;

type Vid = {
  id: string;
  title: string | null;
  mp4_path: string | null;
  source_stream_id: string | null;
  duration_s: number | null;
};

async function eligible(): Promise<Vid[]> {
  let q = admin
    .from("videos")
    .select("id, title, mp4_path, source_stream_id, duration_s")
    .eq("status", "ready")
    .not("mp4_path", "is", null)
    .not("source_stream_id", "is", null);
  if (onlyId) q = q.eq("id", onlyId);
  const { data } = await q;

  const out: Vid[] = [];
  for (const v of data ?? []) {
    const { count } = await admin
      .from("transcript_segments")
      .select("id", { count: "exact", head: true })
      .eq("stream_id", v.source_stream_id!);
    if ((count ?? 0) > 0) {
      console.log(`skip ${v.id} — already has ${count} segments`);
      continue;
    }
    out.push(v as Vid);
  }
  return out.sort((a, b) => (a.duration_s ?? 0) - (b.duration_s ?? 0));
}

async function transcribeOne(v: Vid) {
  const url = vodAssetUrl(v.mp4_path);
  if (!url) return;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `vt-vod-${v.id}-`));
  const wav = path.join(dir, "audio.wav");
  const base = path.join(dir, "out");
  const mins = Math.round((v.duration_s ?? 0) / 60);
  try {
    console.log(`\n[${v.id}] ~${mins}m — extracting audio…`);
    await exec(
      workerConfig.bin.ffmpeg,
      ["-y", "-i", url, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav],
      { timeout: 60 * 60 * 1000 }
    );
    console.log(`[${v.id}] transcribing with whisper (slow)…`);
    const jsonPath = await transcribeWavToJson(wav, base);
    const segs = await loadWhisperSegments(jsonPath);
    const rows = segs.map((s) => ({
      stream_id: v.source_stream_id!,
      start_s: s.startSeconds,
      end_s: s.endSeconds,
      text: s.text,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from("transcript_segments")
        .insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    console.log(`[${v.id}] done — ${rows.length} segments stored.`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const vids = await eligible();
  console.log(`${vids.length} video(s) to transcribe.`);
  for (const v of vids) await transcribeOne(v);
  console.log("\nall done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

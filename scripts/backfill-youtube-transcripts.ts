import { createClient } from "@supabase/supabase-js";
import { execFile } from "child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import type { Database } from "../supabase/types";

const execFileAsync = promisify(execFile);

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const YTDLP = process.env.YTDLP_BIN ?? "yt-dlp";
const FORCE = process.argv.includes("--force");
const videoArgIndex = process.argv.indexOf("--video");
const ONLY_VIDEO =
  videoArgIndex >= 0 ? process.argv[videoArgIndex + 1] : null;
const BATCH = 500;

type SegmentRow = {
  video_id: string;
  start_s: number;
  end_s: number;
  text: string;
};

async function ytdlp(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(YTDLP, args, {
    maxBuffer: 1024 * 1024 * 64,
  });
  return stdout;
}

type Json3Event = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
  aAppend?: number;
};

function parseJson3(videoId: string, path: string): SegmentRow[] {
  const doc = JSON.parse(readFileSync(path, "utf8")) as {
    events?: Json3Event[];
  };
  const rows: SegmentRow[] = [];
  for (const ev of doc.events ?? []) {
    if (ev.tStartMs === undefined || !ev.segs || ev.aAppend) {
      continue;
    }
    const text = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      continue;
    }
    const start = ev.tStartMs / 1000;
    rows.push({
      video_id: videoId,
      start_s: start,
      end_s: start + (ev.dDurationMs ?? 0) / 1000,
      text,
    });
  }
  return rows;
}

async function transcriptRows(videoId: string): Promise<SegmentRow[]> {
  const tmp = mkdtempSync(join(tmpdir(), "yt-transcript-"));
  try {
    await ytdlp([
      "--skip-download",
      "--write-auto-subs",
      "--write-subs",
      "--sub-langs",
      "en.*,en",
      "--sub-format",
      "json3",
      "--no-warnings",
      "-o",
      join(tmp, videoId),
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    const json3File = readdirSync(tmp).find((f) => f.endsWith(".json3"));
    if (!json3File) {
      return [];
    }
    return parseJson3(videoId, join(tmp, json3File));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function doneVideoIds(): Promise<Set<string>> {
  const done = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("youtube_transcripts")
      .select("video_id")
      .order("video_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(error.message);
    }
    for (const r of data ?? []) {
      done.add(r.video_id);
    }
    if ((data ?? []).length < PAGE) {
      return done;
    }
  }
}

async function backfillVideo(videoId: string): Promise<number> {
  const rows = await transcriptRows(videoId);
  if (!rows.length) {
    return 0;
  }
  const { error: deleteError } = await admin
    .from("youtube_transcripts")
    .delete()
    .eq("video_id", videoId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await admin
      .from("youtube_transcripts")
      .insert(rows.slice(i, i + BATCH));
    if (error) {
      throw new Error(error.message);
    }
  }
  return rows.length;
}

async function main() {
  const { data: vods, error } = await admin
    .from("youtube_vods")
    .select("video_id")
    .order("published_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  const done = await doneVideoIds();

  const ids = (vods ?? [])
    .map((v) => v.video_id)
    .filter((id) => (ONLY_VIDEO ? id === ONLY_VIDEO : true))
    .filter((id) => FORCE || !done.has(id));
  console.log(`videos to transcribe: ${ids.length}`);

  let processed = 0;
  let segments = 0;
  let empty = 0;
  const failures: string[] = [];

  for (const id of ids) {
    try {
      const count = await backfillVideo(id);
      processed += 1;
      segments += count;
      if (count === 0) {
        empty += 1;
        console.log(`no captions for ${id}`);
      } else {
        console.log(`transcribed ${id}: ${count} segments`);
      }
    } catch (e) {
      failures.push(`${id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  console.log("--- summary");
  console.log(`processed: ${processed}, no captions: ${empty}`);
  console.log(`segments stored: ${segments}`);
  if (failures.length) {
    console.log(`failures (${failures.length}):`);
    for (const f of failures) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

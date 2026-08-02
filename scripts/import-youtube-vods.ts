import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "fs";
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

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_VOD!;
const OWNER_CHANNEL_SLUG = "azanything";

const bin = (envValue: string | undefined, fallback: string) =>
  envValue && existsSync(envValue) ? envValue : fallback;
const YTDLP = bin(process.env.YTDLP_BIN, "yt-dlp");
const FFMPEG = bin(process.env.FFMPEG_BIN, "ffmpeg");
const FFPROBE = bin(process.env.FFPROBE_BIN, "ffprobe");
const BATCH = 500;

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY_VIDEO = flag("--video");
const LIMIT = flag("--limit") ? Number(flag("--limit")) : Infinity;

const SKIP_NATIVE_REASONS: Record<string, string> = {};
const SKIP_NATIVE = new Set(Object.keys(SKIP_NATIVE_REASONS));

async function upload(key: string, filePath: string, contentType: string) {
  const up = new Upload({
    client: r2,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    },
    queueSize: 4,
    partSize: 64 * 1024 * 1024,
  });
  await up.done();
}

type Info = {
  title?: string;
  description?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  release_timestamp?: number;
  timestamp?: number;
  upload_date?: string;
};

function startEpoch(info: Info): number | null {
  const ts = info.release_timestamp ?? info.timestamp;
  if (ts) return ts;
  if (info.upload_date && /^\d{8}$/.test(info.upload_date)) {
    const d = info.upload_date;
    return Math.floor(Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`) / 1000);
  }
  return null;
}

async function probe(mp4: string): Promise<{ duration: number; width: number | null; height: number | null }> {
  const { stdout } = await execFileAsync(FFPROBE, [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    mp4,
  ]);
  const doc = JSON.parse(stdout);
  return {
    duration: Math.floor(Number(doc.format?.duration ?? 0)),
    width: doc.streams?.[0]?.width ?? null,
    height: doc.streams?.[0]?.height ?? null,
  };
}

async function makeStills(mp4: string, dir: string, duration: number): Promise<{ poster: string | null; previews: string[] }> {
  let poster: string | null = null;
  const posterPath = join(dir, "poster.jpg");
  const seek = duration < 20 ? Math.floor(duration / 2) : 10;
  try {
    await execFileAsync(FFMPEG, ["-y", "-ss", String(seek), "-i", mp4, "-frames:v", "1", posterPath]);
    if (existsSync(posterPath)) poster = posterPath;
  } catch {
    poster = null;
  }
  const previews: string[] = [];
  if (duration > 5) {
    for (const [i, pct] of [5, 25, 45, 65, 85].entries()) {
      const out = join(dir, `preview-${i + 1}.jpg`);
      try {
        await execFileAsync(FFMPEG, [
          "-y", "-ss", String(Math.floor((duration * pct) / 100)),
          "-i", mp4, "-frames:v", "1",
          "-vf", "scale='min(480,iw)':-2",
          out,
        ]);
        if (existsSync(out)) previews.push(out);
      } catch {
        console.error(`preview ${i + 1} failed for ${mp4}`);
      }
    }
  }
  return { poster, previews };
}

async function importChat(videoId: string, streamId: string): Promise<number> {
  const { count: existing } = await admin
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", streamId)
    .eq("origin", "youtube");
  if ((existing ?? 0) > 0) {
    return 0;
  }
  let inserted = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("youtube_chat_archive")
      .select("message_id, author_channel_id, author_name, body, published_at")
      .eq("video_id", videoId)
      .order("published_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((m) => ({
      stream_id: streamId,
      user_id: null,
      origin: "youtube",
      external_author_id: m.author_channel_id,
      author_name: m.author_name,
      external_message_id: m.message_id,
      body: m.body,
      created_at: m.published_at,
    }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: insErr } = await admin.from("chat_messages").insert(rows.slice(i, i + BATCH));
      if (insErr) throw new Error(insErr.message);
      inserted += Math.min(BATCH, rows.length - i);
    }
    if ((data ?? []).length < PAGE) break;
  }
  return inserted;
}

async function importTranscript(videoId: string, streamId: string, offsetS: number): Promise<number> {
  const { error: delErr } = await admin.from("transcript_segments").delete().eq("stream_id", streamId);
  if (delErr) throw new Error(delErr.message);
  let inserted = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("youtube_transcripts")
      .select("start_s, end_s, text")
      .eq("video_id", videoId)
      .order("start_s", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((s) => ({
      stream_id: streamId,
      start_s: s.start_s + offsetS,
      end_s: s.end_s + offsetS,
      text: s.text,
    }));
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: insErr } = await admin.from("transcript_segments").insert(rows.slice(i, i + BATCH));
      if (insErr) throw new Error(insErr.message);
      inserted += Math.min(BATCH, rows.length - i);
    }
    if ((data ?? []).length < PAGE) break;
  }
  return inserted;
}

async function importOne(
  vod: { video_id: string; title: string | null },
  channel: { id: string; slug: string }
): Promise<string> {
  const videoId = vod.video_id;

  const { data: existingStream } = await admin
    .from("streams")
    .select("id, started_at, live_at, status")
    .eq("youtube_video_id", videoId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingStream) {
    const { data: existingVideo } = await admin
      .from("videos")
      .select("id, status, mp4_path")
      .eq("source_stream_id", existingStream.id)
      .maybeSingle();
    if (existingVideo?.status === "ready" && existingVideo.mp4_path) {
      return "already imported";
    }
  }

  const tmp = mkdtempSync(join(tmpdir(), "yt-import-"));
  try {
    await execFileAsync(
      YTDLP,
      [
        "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
        "-S", "res:1080",
        "--merge-output-format", "mp4",
        "--no-progress",
        "--write-info-json",
        "--write-thumbnail",
        "--convert-thumbnails", "jpg",
        "--no-warnings",
        "-o", join(tmp, videoId),
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { maxBuffer: 1024 * 1024 * 64 }
    );

    const mp4 = join(tmp, `${videoId}.mp4`);
    if (!existsSync(mp4)) throw new Error("download produced no mp4");
    const info: Info = existsSync(join(tmp, `${videoId}.info.json`))
      ? JSON.parse(readFileSync(join(tmp, `${videoId}.info.json`), "utf8"))
      : {};

    const { duration, width, height } = await probe(mp4);
    const start = startEpoch(info);
    if (!start) throw new Error("no start timestamp in video metadata");
    const startISO = new Date(start * 1000).toISOString();
    const endISO = new Date((start + duration) * 1000).toISOString();

    const { poster, previews } = await makeStills(mp4, tmp, duration);
    const ytThumb = join(tmp, `${videoId}.jpg`);
    const thumbFile = existsSync(ytThumb) ? ytThumb : poster;

    const keyBase = `vod/${channel.slug}/${start}`;
    const keyMp4 = `${keyBase}.mp4`;
    const keyJpg = `${keyBase}.jpg`;
    const sizeMb = Math.round(statSync(mp4).size / 1024 / 1024);

    await upload(keyMp4, mp4, "video/mp4");
    if (thumbFile) await upload(keyJpg, thumbFile, "image/jpeg");
    const previewKeys: string[] = [];
    for (const [i, p] of previews.entries()) {
      const key = `${keyBase}/preview-${i + 1}.jpg`;
      await upload(key, p, "image/jpeg");
      previewKeys.push(key);
    }

    await admin
      .from("youtube_vods")
      .update({ view_count: info.view_count ?? null, like_count: info.like_count ?? null })
      .eq("video_id", videoId);

    let streamId: string;
    let transcriptOffset = 0;
    if (existingStream) {
      streamId = existingStream.id;
      if (existingStream.started_at) {
        transcriptOffset = Math.max(
          0,
          Math.round(start - Date.parse(existingStream.started_at) / 1000)
        );
      }
    } else {
      const { data: streamRow, error: streamErr } = await admin
        .from("streams")
        .insert({
          channel_id: channel.id,
          status: "ended",
          created_in_ui: false,
          title: info.title ?? vod.title,
          started_at: startISO,
          live_at: startISO,
          ended_at: endISO,
          youtube_video_id: videoId,
        })
        .select("id")
        .single();
      if (streamErr) throw new Error(streamErr.message);
      streamId = streamRow.id;
    }

    const chatCount = await importChat(videoId, streamId);
    const segCount = await importTranscript(videoId, streamId, transcriptOffset);

    const videoFields = {
      status: "ready",
      title: info.title ?? vod.title,
      description: info.description ?? null,
      mp4_path: keyMp4,
      duration_s: duration,
      width,
      height,
      preview_paths: previewKeys,
      published_at: startISO,
    };
    const { data: existingVideo } = await admin
      .from("videos")
      .select("id, thumbnail_path")
      .eq("source_stream_id", streamId)
      .maybeSingle();
    if (existingVideo) {
      const { error: updErr } = await admin
        .from("videos")
        .update({
          ...videoFields,
          thumbnail_path: existingVideo.thumbnail_path ?? (thumbFile ? keyJpg : null),
        })
        .eq("id", existingVideo.id);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: insErr } = await admin.from("videos").insert({
        ...videoFields,
        channel_id: channel.id,
        source_stream_id: streamId,
        thumbnail_path: thumbFile ? keyJpg : null,
      });
      if (insErr) throw new Error(insErr.message);
    }

    return `ok (${sizeMb}MB, ${duration}s, chat=${chatCount}, segs=${segCount})`;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const { data: channel, error: chErr } = await admin
    .from("channels")
    .select("id, slug")
    .eq("slug", OWNER_CHANNEL_SLUG)
    .maybeSingle();
  if (chErr) throw new Error(chErr.message);
  if (!channel) {
    throw new Error(
      `owner channel @${OWNER_CHANNEL_SLUG} not found — refusing to import into an arbitrary channel`
    );
  }
  console.log(`importing into channel: @${channel.slug}`);

  const { data: vods, error } = await admin
    .from("youtube_vods")
    .select("video_id, title, published_at")
    .order("published_at", { ascending: false });
  if (error) throw new Error(error.message);

  const candidates = (vods ?? []).filter((v) =>
    ONLY_VIDEO ? v.video_id === ONLY_VIDEO : !SKIP_NATIVE.has(v.video_id)
  );
  console.log(`candidates: ${candidates.length} (limit ${LIMIT})`);
  if (!ONLY_VIDEO) {
    for (const [id, reason] of Object.entries(SKIP_NATIVE_REASONS)) {
      console.log(`skipping ${id}: ${reason}`);
    }
  }

  let done = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const vod of candidates) {
    if (done >= LIMIT) break;
    try {
      const result = await importOne(vod, channel);
      if (result === "already imported") {
        skipped += 1;
      } else {
        done += 1;
        console.log(`imported ${vod.video_id}: ${result} — ${String(vod.title).slice(0, 60)}`);
      }
    } catch (e) {
      const err = e as Error & { stderr?: string };
      const detail = [err.message, err.stderr].filter(Boolean).join("\n").slice(0, 2000);
      failures.push(`${vod.video_id}: ${detail}`);
      console.error(`failed ${vod.video_id}: ${detail}`);
    }
  }

  console.log("--- summary");
  console.log(`imported: ${done}, already done: ${skipped}, failed: ${failures.length}`);
  for (const f of failures) console.log(`  ${f}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

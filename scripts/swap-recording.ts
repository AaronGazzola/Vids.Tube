// Replaces the file behind an existing recording with its YouTube copy, keeping
// the broadcast and everything hanging off it.
//
// The whole difficulty is one number: how far into the old recording does the
// new one begin. The 8-Aug-2026 broadcast's own timestamps give three answers
// that disagree by about 21 minutes, so the offset is measured from the speech
// in both files and has to earn its way past three checks before anything is
// written.
import { fetchCaptions, groupCaptions } from "@/lib/youtube-captions";
import {
  alignByLag,
  residualDrift,
  type Segment,
} from "@/lib/transcript-align";
import type { Database } from "@/supabase/types";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "child_process";
import { createReadStream, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const flag = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

const SNAPSHOT_DIR = flag("--snapshot-dir") ?? ".snapshots";
const DURATION_TOLERANCE_S = 60;

function fmt(s: number): string {
  const sign = s < 0 ? "-" : "";
  const abs = Math.abs(Math.round(s));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sec = abs % 60;
  return `${sign}${h}h${String(m).padStart(2, "0")}m${String(sec).padStart(2, "0")}s`;
}

type Snapshot = {
  takenAt: string;
  streamId: string;
  offsetS: number;
  video: Record<string, unknown>;
  transcriptSegments: { id: string; start_s: number; end_s: number }[];
  spans: { id: string; start_s: number; end_s: number }[];
  moments: { id: string; start_s: number; end_s: number; peak_s: number }[];
};

async function loadBroadcast(streamId: string) {
  const { data: stream, error } = await admin
    .from("streams")
    .select("id, title, started_at, live_at, ended_at, youtube_video_id")
    .eq("id", streamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!stream) throw new Error("no such broadcast");
  if (!stream.youtube_video_id) {
    throw new Error("this broadcast has no YouTube copy to swap in");
  }

  const { data: video } = await admin
    .from("videos")
    .select("*")
    .eq("source_stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!video) throw new Error("this broadcast has no recording to replace");

  return { stream, video };
}

async function existingTranscript(streamId: string): Promise<Segment[]> {
  const out: Segment[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("transcript_segments")
      .select("start_s, text")
      .eq("stream_id", streamId)
      .order("start_s", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) out.push({ startS: r.start_s, text: r.text });
    if ((data ?? []).length < PAGE) return out;
  }
}

async function checkMoments(
  streamId: string,
  offsetS: number,
  replacement: Segment[]
) {
  const { data: messages } = await admin
    .from("chat_messages")
    .select("body, created_at, author_name")
    .eq("stream_id", streamId)
    .neq("origin", "bot")
    .order("created_at", { ascending: true });

  const { data: stream } = await admin
    .from("streams")
    .select("started_at")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream?.started_at || !messages?.length) return [];

  const recordingStart = new Date(stream.started_at).getTime();
  const withOffsets = messages
    .map((m) => ({
      ...m,
      oldS: (new Date(m.created_at).getTime() - recordingStart) / 1000,
    }))
    .filter((m) => m.oldS > 0);

  const picks = [0.25, 0.5, 0.75].map(
    (fraction) => withOffsets[Math.floor(withOffsets.length * fraction)]
  );

  return picks.filter(Boolean).map((m) => {
    const newS = m.oldS - offsetS;
    const nearest = replacement.reduce(
      (best, seg) =>
        Math.abs(seg.startS - newS) < Math.abs(best.startS - newS) ? seg : best,
      replacement[0]
    );
    return {
      atNewS: newS,
      chat: `${m.author_name ?? "someone"}: ${m.body.slice(0, 70)}`,
      saying: nearest ? nearest.text.slice(0, 90) : "(nothing transcribed here)",
    };
  });
}

async function main() {
  const streamId = flag("--stream");
  if (!streamId) throw new Error("pass --stream <broadcast id>");

  if (has("--undo")) return undo(streamId);

  const { stream, video } = await loadBroadcast(streamId);
  const youtubeId = stream.youtube_video_id!;

  console.log(`broadcast:      ${stream.title ?? "untitled"}`);
  console.log(`recording now:  ${fmt(video.duration_s ?? 0)}`);

  const liveToEnd =
    stream.live_at && stream.ended_at
      ? (new Date(stream.ended_at).getTime() -
          new Date(stream.live_at).getTime()) /
        1000
      : null;
  if (liveToEnd) console.log(`live portion:   ${fmt(liveToEnd)}`);

  const oldSegments = await existingTranscript(streamId);
  console.log(`transcript:     ${oldSegments.length} segments held here`);
  if (oldSegments.length < 50) {
    throw new Error(
      "too little transcript to align against; nothing can be measured"
    );
  }

  console.log(`fetching captions for the replacement...`);
  const raw = await fetchCaptions(youtubeId);
  if (!raw.length) {
    throw new Error(
      "no caption track for the replacement — refusing to guess an offset from timestamps"
    );
  }
  const newSegments = groupCaptions(raw);
  console.log(`captions:       ${newSegments.length} spans on the replacement`);

  const maxLag = (video.duration_s ?? 12000) + 600;
  const alignment = alignByLag(oldSegments, newSegments, {
    minS: -600,
    maxS: maxLag,
  });
  const drift = residualDrift(alignment.residuals);

  console.log("");
  console.log(`offset:         ${fmt(alignment.offsetS)} (${alignment.offsetS}s)`);
  console.log(`agreed:         ${alignment.matched} segments`);
  console.log(
    `runner-up:      ${alignment.runnerUpMatched} segments at ${fmt(
      alignment.runnerUpOffsetS
    )}`
  );
  console.log(
    `residual drift: ${drift.slopePerHour.toFixed(2)}s per hour, spread ${drift.spreadS.toFixed(
      1
    )}s${drift.flat ? " (flat)" : " (DRIFTING)"}`
  );

  if (!alignment.confident) {
    throw new Error(
      "the offset could not be measured confidently — nothing written"
    );
  }
  if (!drift.flat) {
    throw new Error(
      `residuals drift from ${fmt(
        drift.firstDriftAtS ?? 0
      )}, so the replacement lost an interior section and no single offset describes it — nothing written`
    );
  }

  const newDuration = newSegments[newSegments.length - 1].startS;
  const accounted = newDuration + alignment.offsetS;
  const expected = video.duration_s ?? 0;
  console.log(
    `duration check: replacement ends ~${fmt(newDuration)}, plus offset = ${fmt(
      accounted
    )} against ${fmt(expected)} of original`
  );
  if (Math.abs(accounted - expected) > DURATION_TOLERANCE_S * 4) {
    throw new Error(
      "the replacement's duration plus the offset does not account for the original — nothing written"
    );
  }

  console.log("");
  console.log("check these three before making it public:");
  for (const m of await checkMoments(streamId, alignment.offsetS, newSegments)) {
    console.log(`  at ${fmt(m.atNewS)}`);
    console.log(`    chat:   ${m.chat}`);
    console.log(`    saying: ${m.saying}`);
  }

  if (!has("--apply")) {
    console.log("");
    console.log("dry run — nothing changed. add --apply.");
    return;
  }

  await apply(streamId, youtubeId, video, alignment.offsetS);
}

async function apply(
  streamId: string,
  youtubeId: string,
  video: Record<string, unknown> & { id: string },
  offsetS: number
) {
  const { data: segments } = await admin
    .from("transcript_segments")
    .select("id, start_s, end_s")
    .eq("stream_id", streamId);
  const { data: spans } = await admin
    .from("stream_thread_spans")
    .select("id, start_s, end_s")
    .eq("stream_id", streamId);
  const { data: moments } = await admin
    .from("stream_moments")
    .select("id, start_s, end_s, peak_s")
    .eq("stream_id", streamId);

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const snapshot: Snapshot = {
    takenAt: new Date().toISOString(),
    streamId,
    offsetS,
    video,
    transcriptSegments: segments ?? [],
    spans: spans ?? [],
    moments: moments ?? [],
  };
  const snapshotPath = join(SNAPSHOT_DIR, `swap-${streamId}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`snapshot written to ${snapshotPath}`);

  console.log("downloading the replacement...");
  const localPath = join(SNAPSHOT_DIR, `${youtubeId}.mp4`);
  await execFileAsync(
    process.env.YTDLP_BIN ?? "yt-dlp",
    [
      "-f",
      "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
      "-o",
      localPath,
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ],
    { maxBuffer: 1024 * 1024 * 64 }
  );

  // Beside the original rather than over it, so an undo has something to go
  // back to.
  const newKey = `vod/owner/${youtubeId}-replacement.mp4`;
  console.log(`uploading to ${newKey} ...`);
  const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  await new Upload({
    client: r2,
    params: {
      Bucket: process.env.R2_BUCKET_VOD!,
      Key: newKey,
      Body: createReadStream(localPath),
      ContentType: "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    },
    queueSize: 4,
    partSize: 64 * 1024 * 1024,
  }).done();

  for (const row of segments ?? []) {
    await admin
      .from("transcript_segments")
      .update({ start_s: row.start_s - offsetS, end_s: row.end_s - offsetS })
      .eq("id", row.id);
  }
  for (const row of spans ?? []) {
    await admin
      .from("stream_thread_spans")
      .update({ start_s: row.start_s - offsetS, end_s: row.end_s - offsetS })
      .eq("id", row.id);
  }
  for (const row of moments ?? []) {
    await admin
      .from("stream_moments")
      .update({
        start_s: row.start_s - offsetS,
        end_s: row.end_s - offsetS,
        peak_s: row.peak_s - offsetS,
      })
      .eq("id", row.id);
  }

  // Where the replacement's file begins in wall-clock time. Chat replay reads
  // this rather than assuming the file starts at go-live, which is the
  // assumption that would have left chat about a minute out after the swap.
  const { data: streamRow } = await admin
    .from("streams")
    .select("started_at")
    .eq("id", streamId)
    .maybeSingle();
  const fileStartsAt = streamRow?.started_at
    ? new Date(new Date(streamRow.started_at).getTime() + offsetS * 1000)
    : null;

  const { error } = await admin
    .from("videos")
    .update({
      mp4_path: newKey,
      duration_s: (video.duration_s as number) - offsetS,
      starts_at: fileStartsAt ? fileStartsAt.toISOString() : null,
      visibility: "private",
      status: "ready",
    })
    .eq("id", video.id);
  if (error) throw new Error(error.message);

  console.log("");
  console.log("swapped, and left private. check the three moments, then set it");
  console.log("to public from the studio.");
}

async function undo(streamId: string) {
  const path = join(SNAPSHOT_DIR, `swap-${streamId}.json`);
  const snapshot = JSON.parse(readFileSync(path, "utf8")) as Snapshot;

  for (const row of snapshot.transcriptSegments) {
    await admin
      .from("transcript_segments")
      .update({ start_s: row.start_s, end_s: row.end_s })
      .eq("id", row.id);
  }
  for (const row of snapshot.spans) {
    await admin
      .from("stream_thread_spans")
      .update({ start_s: row.start_s, end_s: row.end_s })
      .eq("id", row.id);
  }
  for (const row of snapshot.moments) {
    await admin
      .from("stream_moments")
      .update({
        start_s: row.start_s,
        end_s: row.end_s,
        peak_s: row.peak_s,
      })
      .eq("id", row.id);
  }
  const video = snapshot.video as { id: string } & Record<string, unknown>;
  await admin
    .from("videos")
    .update({
      mp4_path: video.mp4_path as string,
      duration_s: video.duration_s as number,
      starts_at: (video.starts_at as string | null) ?? null,
      status: video.status as string,
      visibility: video.visibility as string,
    })
    .eq("id", video.id);

  console.log(`restored from ${path}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { workerConfig } from "../config";
import { startHlsAudioSegmenter } from "../lib/ffmpeg";
import {
  type EligibleStream,
  isStreamEligible,
  renewLock,
} from "../lib/streams";
import { loadWhisperSegments, transcribeWavToJson } from "../lib/whisper";
import { supabaseAdmin } from "../supabase";

const CHUNK = workerConfig.transcription.chunkSeconds;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkName(index: number): string {
  return `chunk-${String(index).padStart(5, "0")}`;
}

async function existingMaxEndS(streamId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("transcript_segments")
    .select("end_s")
    .eq("stream_id", streamId)
    .order("end_s", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.end_s ?? 0;
}

async function transcribeChunk(
  streamId: string,
  workDir: string,
  index: number,
  baseline: number
): Promise<void> {
  const wav = path.join(workDir, `${chunkName(index)}.wav`);
  const base = path.join(workDir, chunkName(index));
  const offset = baseline + index * CHUNK;

  let jsonPath: string;
  try {
    jsonPath = await transcribeWavToJson(wav, base);
  } catch (e) {
    console.error(`whisper failed on chunk ${index}:`, e);
    await fs.rm(wav, { force: true });
    return;
  }

  const segments = await loadWhisperSegments(jsonPath);
  const rows = segments.map((s) => ({
    stream_id: streamId,
    start_s: offset + s.startSeconds,
    end_s: offset + s.endSeconds,
    text: s.text,
  }));

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("transcript_segments")
      .insert(rows);
    if (error) {
      console.error(`insert failed for chunk ${index}:`, error);
    } else {
      console.error(
        `[transcribe] chunk ${index}: ${rows.map((r) => r.text).join(" ").slice(0, 80)}`
      );
    }
  }

  await fs.rm(wav, { force: true });
  await fs.rm(jsonPath, { force: true });
}

export async function runTranscriptionJob(
  stream: EligibleStream
): Promise<void> {
  const workDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `vt-transcribe-${stream.id}-`)
  );
  const outPattern = path.join(workDir, "chunk-%05d.wav");

  const baseFromClock = Math.max(0, (Date.now() - stream.startedAtMs) / 1000);
  const baseline = Math.max(baseFromClock, await existingMaxEndS(stream.id));

  const pullUrl = workerConfig.pullUrl();
  console.error(
    `[transcribe] segmenting audio from ${pullUrl} every ${CHUNK}s`
  );
  const seg = startHlsAudioSegmenter(pullUrl, outPattern, CHUNK);
  let segExited = false;
  let segErr = "";
  seg.stderr?.on("data", (d: Buffer) => {
    segErr = (segErr + d.toString()).slice(-2000);
  });
  seg.on("error", (e) => {
    console.error(`[transcribe] segmenter spawn error: ${e.message}`);
    segExited = true;
  });
  seg.on("close", (code) => {
    segExited = true;
    if (code) {
      console.error(
        `[transcribe] segmenter exited (code ${code}): ${segErr.slice(-300)}`
      );
    }
  });

  let processedIndex = -1;
  try {
    for (;;) {
      await renewLock(stream.id, workerConfig.loop.lockLeaseMs);

      const indices = (await fs.readdir(workDir))
        .filter((f) => f.endsWith(".wav"))
        .map((f) => Number(f.slice(6, 11)))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
      const maxIndex = indices.length ? indices[indices.length - 1] : -1;

      for (const idx of indices) {
        const complete = idx < maxIndex || segExited;
        if (!complete || idx <= processedIndex) continue;
        await transcribeChunk(stream.id, workDir, idx, baseline);
        processedIndex = idx;
      }

      if (segExited && processedIndex >= maxIndex) break;
      if (!(await isStreamEligible(stream.id))) break;
      await sleep(2000);
    }
  } finally {
    if (!segExited) seg.kill("SIGKILL");
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

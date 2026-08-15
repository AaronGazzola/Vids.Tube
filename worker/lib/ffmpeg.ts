import { type ChildProcess, spawn } from "child_process";
import { workerConfig } from "../config";
import { resolveFfmpeg } from "./resolve-bin";

// Resolved rather than taken from configuration: the configured path is
// absolute into one Windows user's home, and the broadcast runs under a
// different account from the one that set it.
export async function startHlsAudioSegmenter(
  hlsUrl: string,
  outPattern: string,
  chunkSeconds: number
): Promise<ChildProcess> {
  const bin = await resolveFfmpeg(workerConfig.bin.ffmpeg);
  return spawn(
    bin,
    [
      "-y",
      "-i",
      hlsUrl,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      "-f",
      "segment",
      "-segment_time",
      String(chunkSeconds),
      "-reset_timestamps",
      "1",
      outPattern,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );
}

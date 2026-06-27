import { type ChildProcess, spawn } from "child_process";
import { workerConfig } from "../config";

export function startHlsAudioSegmenter(
  hlsUrl: string,
  outPattern: string,
  chunkSeconds: number
): ChildProcess {
  return spawn(
    workerConfig.bin.ffmpeg,
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

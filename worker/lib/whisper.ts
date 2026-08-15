import { promises as fs } from "fs";
import { workerConfig } from "../config";
import { exec } from "./exec";
import { resolveFile, resolveWhisper } from "./resolve-bin";

export interface WhisperSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export async function transcribeWavToJson(
  wavPath: string,
  outputBasename: string
): Promise<string> {
  // Resolved rather than taken from configuration: the configured paths are
  // absolute into one Windows user's home, and the broadcast runs under a
  // different account from the one that set them.
  const bin = await resolveWhisper(workerConfig.bin.whisper);
  const model = resolveFile(workerConfig.bin.whisperModel);
  if (!model) {
    throw new Error(
      `whisper model not found at ${workerConfig.bin.whisperModel}, nor under this user's home`
    );
  }
  await exec(bin, [
    "-m",
    model,
    "-f",
    wavPath,
    "-oj",
    "-of",
    outputBasename,
    "-l",
    "auto",
    "-pp",
    "-t",
    String(workerConfig.transcription.whisperThreads),
  ]);
  return `${outputBasename}.json`;
}

export async function loadWhisperSegments(
  jsonPath: string
): Promise<WhisperSegment[]> {
  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as {
    transcription: Array<{
      offsets: { from: number; to: number };
      text: string;
    }>;
  };
  return parsed.transcription
    .map((s) => ({
      startSeconds: s.offsets.from / 1000,
      endSeconds: s.offsets.to / 1000,
      text: s.text.trim(),
    }))
    .filter((s) => s.text.length > 0);
}

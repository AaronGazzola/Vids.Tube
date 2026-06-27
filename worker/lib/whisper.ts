import { promises as fs } from "fs";
import { workerConfig } from "../config";
import { exec } from "./exec";

export interface WhisperSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export async function transcribeWavToJson(
  wavPath: string,
  outputBasename: string
): Promise<string> {
  await exec(workerConfig.bin.whisper, [
    "-m",
    workerConfig.bin.whisperModel,
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

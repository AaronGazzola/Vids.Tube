import { workerConfig } from "../config";
import { exec } from "./exec";

export async function runClaude(prompt: string): Promise<string> {
  const { stdout } = await exec(
    workerConfig.bin.claude,
    ["-p", "--model", workerConfig.bin.claudeModel, "--output-format", "text"],
    { input: prompt, timeout: 30 * 60 * 1000 }
  );
  return stdout.trim();
}

export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(
      `No JSON object found in claude output: ${raw.slice(0, 500)}`
    );
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

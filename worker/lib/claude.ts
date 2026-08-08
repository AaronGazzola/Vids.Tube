import { workerConfig } from "../config";
import { exec } from "./exec";

export { extractJson } from "../../lib/extract-json";

export async function runClaude(prompt: string): Promise<string> {
  const { stdout } = await exec(
    workerConfig.bin.claude,
    ["-p", "--model", workerConfig.bin.claudeModel, "--output-format", "text"],
    { input: prompt, timeout: 30 * 60 * 1000 }
  );
  return stdout.trim();
}

import { workerConfig } from "../config";
import { exec } from "./exec";
import { resolveClaude } from "./resolve-bin";

export { extractJson } from "../../lib/extract-json";

export async function runClaude(prompt: string): Promise<string> {
  // Resolved rather than taken from configuration, because the configured value
  // comes from Doppler and this machine runs the worker under a different user
  // from the one that set it.
  const bin = await resolveClaude(workerConfig.bin.claude);
  const { stdout } = await exec(
    bin,
    ["-p", "--model", workerConfig.bin.claudeModel, "--output-format", "text"],
    { input: prompt, timeout: 30 * 60 * 1000 }
  );
  return stdout.trim();
}

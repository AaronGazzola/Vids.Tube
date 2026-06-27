import { promises as fs } from "fs";
import { workerConfig } from "./config";
import { exec } from "./lib/exec";
import { supabaseAdmin } from "./supabase";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function checkBinary(
  label: string,
  bin: string,
  args: string[]
): Promise<Check> {
  try {
    await exec(bin, args, { timeout: 15_000 });
    return { name: label, ok: true, detail: `${bin} reachable` };
  } catch (e) {
    return { name: label, ok: false, detail: (e as Error).message.split("\n")[0] };
  }
}

async function main(): Promise<void> {
  const checks: Check[] = [];

  const model = workerConfig.bin.whisperModel;
  if (!model) {
    checks.push({ name: "whisper-model", ok: false, detail: "WHISPER_MODEL not set" });
  } else {
    try {
      await fs.access(model);
      checks.push({ name: "whisper-model", ok: true, detail: model });
    } catch {
      checks.push({ name: "whisper-model", ok: false, detail: `missing file: ${model}` });
    }
  }

  checks.push(await checkBinary("whisper", workerConfig.bin.whisper, ["--help"]));
  checks.push(await checkBinary("ffmpeg", workerConfig.bin.ffmpeg, ["-version"]));
  checks.push(await checkBinary("claude", workerConfig.bin.claude, ["--version"]));

  try {
    const { error } = await supabaseAdmin.from("streams").select("id").limit(1);
    if (error) throw new Error(error.message);
    checks.push({ name: "supabase", ok: true, detail: "reachable" });
  } catch (e) {
    checks.push({ name: "supabase", ok: false, detail: (e as Error).message });
  }

  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}: ${c.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.log(`\n${failed.length} check(s) failed`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

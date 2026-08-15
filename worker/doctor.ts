import { workerConfig } from "./config";
import {
  FFMPEG_CANDIDATES,
  FFMPEG_PROBE,
  findBinary,
  findClaude,
  resolveFile,
  WHISPER_CANDIDATES,
} from "./lib/resolve-bin";
import { supabaseAdmin } from "./supabase";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}


async function main(): Promise<void> {
  const checks: Check[] = [];

  // Every one of these is resolved the way the job that uses it resolves it, so
  // the doctor reports what the worker can actually do. Configured paths are
  // absolute into one Windows user's home, and this machine broadcasts under a
  // different account, so reporting the configured value would fail every check
  // on one account and pass on the other while nothing was wrong.
  const model = resolveFile(workerConfig.bin.whisperModel);
  checks.push(
    model
      ? { name: "whisper-model", ok: true, detail: model }
      : {
          name: "whisper-model",
          ok: false,
          detail: workerConfig.bin.whisperModel
            ? `not found: ${workerConfig.bin.whisperModel}, nor under this user's home`
            : "WHISPER_MODEL not set",
        }
  );

  const whisperBin = await findBinary(
    "whisper",
    workerConfig.bin.whisper,
    WHISPER_CANDIDATES
  );
  checks.push(
    whisperBin
      ? { name: "whisper", ok: true, detail: whisperBin }
      : { name: "whisper", ok: false, detail: "not found in any known location" }
  );

  const ffmpegBin = await findBinary(
    "ffmpeg",
    workerConfig.bin.ffmpeg,
    FFMPEG_CANDIDATES,
    FFMPEG_PROBE
  );
  checks.push(
    ffmpegBin
      ? { name: "ffmpeg", ok: true, detail: ffmpegBin }
      : { name: "ffmpeg", ok: false, detail: "not found in any known location" }
  );
  // Resolved rather than taken from configuration, so the doctor agrees with
  // what scoring will actually spawn. A stale CLAUDE_BIN from another user
  // account on this machine is not a fault worth reporting.
  const claudeBin = await findClaude(workerConfig.bin.claude);
  checks.push(
    claudeBin
      ? { name: "claude", ok: true, detail: claudeBin }
      : { name: "claude", ok: false, detail: "not found in any known location" }
  );

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

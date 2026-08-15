// One sweep over the broadcasts owing work, then exit.
//
// Deliberately not a long-lived process. A process that sleeps between passes
// can wedge and go quiet, which is the exact fault this project spent a change
// fixing in the chat reader. A command that exits cannot: the scheduler starts
// the next one regardless of how the last one ended, and a crash costs one
// cycle.
//
// Install it on an always-on machine. See docs/runbooks/maintenance-runner.md.
import { execFile } from "child_process";
import { promisify } from "util";
import { workerConfig } from "./config";
import { catchUpEndedBroadcasts, outstandingBroadcasts } from "./lib/post-broadcast";

const execFileAsync = promisify(execFile);

const BATCH = 3;

// Resolved the way the step that needs it resolves it, not through a shell.
// Checking through a shell passed on a machine where scoring could not actually
// spawn Claude, which is a preflight that reports a machine as ready and then
// records the failure against a broadcast instead.
async function canRun(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ["--version"]);
    return true;
  } catch {
    return false;
  }
}

// Settling runs yt-dlp and a Claude call over the whole chat log, and reads the
// production secrets. A machine missing any of those would fail inside a step
// and record that against a broadcast, which reads as bad data rather than an
// unprepared machine.
async function preflight(): Promise<string[]> {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SECRET_KEY) missing.push("SUPABASE_SECRET_KEY");
  if (!(await canRun(process.env.YTDLP_BIN ?? "yt-dlp")))
    missing.push("yt-dlp (needed to download a chat replay)");
  if (!(await canRun(workerConfig.bin.claude)))
    missing.push(
      `${workerConfig.bin.claude} (needed to score chat; set CLAUDE_BIN if it is elsewhere)`
    );
  return missing;
}

async function main() {
  const missing = await preflight();
  if (missing.length) {
    console.error("maintenance runner cannot start; missing:");
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  const owed = await outstandingBroadcasts();
  if (!owed.length) {
    console.log("nothing owing");
    return;
  }

  console.log(`${owed.length} broadcast(s) owing work:`);
  for (const b of owed.slice(0, BATCH)) {
    console.log(`  ${b.endedAt?.slice(0, 10) ?? "undated"}  ${b.phase}  ${b.id}`);
  }

  const { ran, remaining } = await catchUpEndedBroadcasts(BATCH);
  console.log(`settled ${ran} this sweep`);
  // Never silent about what was left. A capped sweep that says nothing reads as
  // "everything is done".
  if (remaining) console.log(`${remaining} left for the next sweep`);
}

// A broadcast failing a step is not the sweep failing. Exiting non-zero for that
// would have the scheduler treat a data problem as a broken runner.
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

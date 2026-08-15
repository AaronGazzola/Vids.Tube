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
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { workerConfig } from "./config";
import { catchUpEndedBroadcasts, outstandingBroadcasts } from "./lib/post-broadcast";
import { findClaude } from "./lib/resolve-bin";

const execFileAsync = promisify(execFile);

const BATCH = 3;

// A sweep settles up to three broadcasts, each of them minutes of serial work
// including a Claude call over a whole chat log. That can outlast the 30 minutes
// until the scheduler starts the next one, and two sweeps working the same
// broadcast would score it twice. The lock makes overlapping sweeps a no-op
// rather than a correctness problem, which is what "leave it on" requires.
const LOCK_DIR = join(tmpdir(), "vids-tube");
const LOCK_FILE = join(LOCK_DIR, "maintain.lock");
// Long enough that a slow sweep is never mistaken for a dead one, short enough
// that a machine killed mid-sweep recovers by itself rather than needing a
// person to delete a file.
const LOCK_STALE_MS = 4 * 60 * 60 * 1000;

function takeLock(nowMs: number): boolean {
  mkdirSync(LOCK_DIR, { recursive: true });
  if (existsSync(LOCK_FILE)) {
    const held = Number(readFileSync(LOCK_FILE, "utf8").split("\n")[1] ?? 0);
    if (nowMs - held < LOCK_STALE_MS) return false;
    console.error("[maintain] clearing a stale lock from a sweep that never finished");
  }
  writeFileSync(LOCK_FILE, `${process.pid}\n${nowMs}\n`);
  return true;
}

function releaseLock(): void {
  rmSync(LOCK_FILE, { force: true });
}

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
  // Resolved the way scoring resolves it, so the preflight cannot pass on a
  // machine that then fails inside a step and records that against a broadcast.
  if (!(await findClaude(workerConfig.bin.claude)))
    missing.push("the Claude CLI (needed to score chat), not found in any known location");
  return missing;
}

async function main() {
  const missing = await preflight();
  if (missing.length) {
    console.error("maintenance runner cannot start; missing:");
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }

  if (!takeLock(Date.now())) {
    console.log("another sweep is still running; leaving this one to it");
    return;
  }

  try {
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
    // Never silent about what was left. A capped sweep that says nothing reads
    // as "everything is done".
    if (remaining) console.log(`${remaining} left for the next sweep`);
  } finally {
    releaseLock();
  }
}

// A broadcast failing a step is not the sweep failing. Exiting non-zero for that
// would have the scheduler treat a data problem as a broken runner.
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

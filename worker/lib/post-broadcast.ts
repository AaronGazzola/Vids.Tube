// Turns a finished broadcast into complete community data: save the chat log,
// add what the live poller missed, score the chat, rebuild the memberships that
// follow, check the ledger.
//
// Each step already exists as a script that a person can run by hand. The pass
// invokes those scripts rather than reimplementing them, so a fix in one is a
// fix everywhere and the automatic path cannot drift from the manual one.
import { spawn } from "child_process";
import {
  blockedBy,
  isClean,
  STEP_ORDER,
  shouldSkip,
  type StepName,
  type StepOutcome,
} from "@/lib/post-broadcast-plan";
import { supabaseAdmin } from "../supabase";

const STEP_COMMANDS: Record<StepName, (streamId: string, videoId: string | null) => string[] | null> = {
  saveChatLog: (_s, videoId) =>
    videoId ? ["scripts/backfill-youtube-chat.ts", "--only-empty"] : null,
  topUpChat: (streamId) => ["scripts/topup-youtube-chat.ts", "--stream", streamId, "--apply"],
  scoreChat: (streamId) => [
    "scripts/backfill-chat-scores.ts",
    "--stream",
    streamId,
    "--apply",
    "--skip-scored",
  ],
  rebuildMemberships: (streamId) => [
    "scripts/recompute-memberships.ts",
    "--stream",
    streamId,
    "--apply",
  ],
  checkLedger: () => ["scripts/verify-credit-ledger.ts"],
};

function runScript(args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", ...args], {
      env: process.env,
      shell: true,
    });
    let output = "";
    child.stdout.on("data", (d) => {
      output += String(d);
    });
    child.stderr.on("data", (d) => {
      output += String(d);
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: output.trim().slice(-2000) });
    });
    child.on("error", (e) => {
      resolve({ ok: false, output: e.message });
    });
  });
}

async function readRecord(streamId: string) {
  const { data } = await supabaseAdmin
    .from("broadcast_completions")
    .select("clean, steps, attempts")
    .eq("stream_id", streamId)
    .maybeSingle();
  return data ?? null;
}

async function writeRecord(
  streamId: string,
  outcomes: StepOutcome[],
  finished: boolean,
  attempts: number
) {
  const steps: Record<string, { ok: boolean; detail?: string | null; error?: string }> = {};
  for (const o of outcomes) {
    steps[o.step] = o.ok ? { ok: true, detail: o.detail ?? null } : { ok: false, error: o.error };
  }
  const { error } = await supabaseAdmin.from("broadcast_completions").upsert(
    {
      stream_id: streamId,
      steps: steps as never,
      clean: finished && isClean(outcomes),
      attempts,
      finished_at: finished ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stream_id" }
  );
  if (error) console.error(`completion record write failed: ${error.message}`);
}

export async function runPostBroadcastPass(
  streamId: string
): Promise<{ ran: boolean; clean: boolean; outcomes: StepOutcome[] }> {
  const existing = await readRecord(streamId);
  if (shouldSkip(existing)) {
    return { ran: false, clean: true, outcomes: [] };
  }

  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("youtube_video_id, started_at")
    .eq("id", streamId)
    .maybeSingle();
  const videoId = stream?.youtube_video_id ?? null;
  const attempts = (existing?.attempts ?? 0) + 1;

  // The record is written before any work, so a second worker finds it and
  // leaves this broadcast alone.
  await writeRecord(streamId, [], false, attempts);
  console.error(`[post] starting pass for ${streamId} (attempt ${attempts})`);

  const outcomes: StepOutcome[] = [];
  for (const step of STEP_ORDER) {
    const blocker = blockedBy(step, outcomes);
    if (blocker) {
      outcomes.push({
        step,
        ok: false,
        error: `skipped because ${blocker} failed`,
      });
      console.error(`[post]   ${step}: skipped, ${blocker} failed`);
      continue;
    }

    const args = STEP_COMMANDS[step](streamId, videoId);
    if (!args) {
      outcomes.push({ step, ok: true, detail: "not applicable" });
      console.error(`[post]   ${step}: not applicable`);
      await writeRecord(streamId, outcomes, false, attempts);
      continue;
    }

    const { ok, output } = await runScript(args);
    outcomes.push(
      ok
        ? { step, ok: true, detail: output.split("\n").slice(-1)[0] }
        : { step, ok: false, error: output.split("\n").slice(-1)[0] }
    );
    console.error(`[post]   ${step}: ${ok ? "ok" : "failed"}`);
    await writeRecord(streamId, outcomes, false, attempts);
  }

  const clean = isClean(outcomes);
  await writeRecord(streamId, outcomes, true, attempts);
  console.error(`[post] pass for ${streamId} finished ${clean ? "clean" : "with failures"}`);
  return { ran: true, clean, outcomes };
}

// A broadcast that ended without being repaired. Absence of a record is the
// signal, not recency: the abandoned broadcast sweep ends broadcasts hours
// late, so a watermark would skip them.
async function outstandingBroadcasts(): Promise<string[]> {
  const { data: ended } = await supabaseAdmin
    .from("streams")
    .select("id")
    .eq("status", "ended")
    .order("started_at", { ascending: false });
  if (!ended?.length) return [];

  const { data: records } = await supabaseAdmin
    .from("broadcast_completions")
    .select("stream_id, clean");
  const done = new Set((records ?? []).filter((r) => r.clean).map((r) => r.stream_id));

  return ended.filter((s) => !done.has(s.id)).map((s) => s.id);
}

// Repairing is minutes of serial work per broadcast, each step a child process
// and one of them a Claude call over the whole chat log. It also rebuilds the
// same membership rows a live broadcast writes, so it runs as its own command
// rather than inside the worker.
export async function catchUpEndedBroadcasts(limit = 5): Promise<number> {
  const outstanding = (await outstandingBroadcasts()).slice(0, limit);
  if (!outstanding.length) return 0;

  console.error(`[post] repairing ${outstanding.length} broadcast(s)`);
  let ran = 0;
  for (const id of outstanding) {
    try {
      const res = await runPostBroadcastPass(id);
      if (res.ran) ran += 1;
    } catch (e) {
      console.error(`[post] repair failed for ${id}:`, e);
    }
  }
  return ran;
}

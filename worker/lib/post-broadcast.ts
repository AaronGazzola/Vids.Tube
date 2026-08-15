// Turns a finished broadcast into complete community data, in two phases.
//
// Scoring runs as soon as a broadcast has ended: score the chat, rebuild the
// memberships that follow, check the ledger. Settling runs once the YouTube chat
// replay could exist, a day later: save the chat log, add what live capture
// missed, score those, rebuild again.
//
// Each step already exists as a script that a person can run by hand. The pass
// invokes those scripts rather than reimplementing them, so a fix in one is a
// fix everywhere and the automatic path cannot drift from the manual one.
import { spawn } from "child_process";
import {
  blockedBy,
  isClean,
  judgeStep,
  type Phase,
  phaseOwed,
  type SettleOutcome,
  settleOutcome,
  stepsForPhase,
  type StepName,
  type StepOutcome,
} from "@/lib/post-broadcast-plan";
import { parseStepResult } from "@/lib/step-result";
import { supabaseAdmin } from "../supabase";

const STEP_COMMANDS: Record<
  StepName,
  (streamId: string, videoId: string | null) => string[] | null
> = {
  // One video, so the result describes the broadcast it is stored against.
  saveChatLog: (_s, videoId) =>
    videoId ? ["scripts/backfill-youtube-chat.ts", "--video", videoId] : null,
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
      resolve({ ok: code === 0, output: output.trim().slice(-4000) });
    });
    child.on("error", (e) => {
      resolve({ ok: false, output: e.message });
    });
  });
}

type Record_ = {
  clean: boolean;
  settled: boolean | null;
  attempts: number;
};

async function readRecord(streamId: string): Promise<Record_ | null> {
  const { data } = await supabaseAdmin
    .from("broadcast_completions")
    .select("clean, settled, attempts")
    .eq("stream_id", streamId)
    .maybeSingle();
  return data ?? null;
}

async function writeRecord(
  streamId: string,
  phase: Phase,
  outcomes: StepOutcome[],
  finished: boolean,
  attempts: number,
  settle?: { settled: boolean; note: string }
) {
  const steps: Record<string, unknown> = {};
  for (const o of outcomes) {
    steps[o.step] =
      o.status === "ok"
        ? { ok: true, result: o.result ?? null }
        : { ok: false, status: o.status, error: o.error ?? null, result: o.result ?? null };
  }
  const row: Record<string, unknown> = {
    stream_id: streamId,
    steps: steps as never,
    attempts,
    finished_at: finished ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // The score phase is what `clean` describes. A settle phase re-running its
  // steps must not un-clean a broadcast that scored fine on the night.
  if (phase === "score") row.clean = finished && isClean(outcomes, "score");
  if (settle) {
    row.settled = settle.settled;
    row.settle_note = settle.note;
    row.settled_at = settle.settled ? new Date().toISOString() : null;
  }
  const { error } = await supabaseAdmin
    .from("broadcast_completions")
    .upsert(row as never, { onConflict: "stream_id" });
  if (error) console.error(`completion record write failed: ${error.message}`);
}

export async function runPostBroadcastPass(
  streamId: string,
  phase?: Phase
): Promise<{ ran: boolean; phase: Phase | null; clean: boolean; outcomes: StepOutcome[] }> {
  const existing = await readRecord(streamId);

  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("youtube_video_id, ended_at")
    .eq("id", streamId)
    .maybeSingle();
  const videoId = stream?.youtube_video_id ?? null;
  const endedAt = stream?.ended_at ?? null;

  const owed = phase ?? phaseOwed(existing, endedAt);
  if (!owed) {
    return { ran: false, phase: null, clean: true, outcomes: [] };
  }

  const attempts = (existing?.attempts ?? 0) + 1;
  await writeRecord(streamId, owed, [], false, attempts);
  console.error(`[post] ${owed} phase for ${streamId} (attempt ${attempts})`);

  const outcomes: StepOutcome[] = [];
  let archived = 0;

  for (const step of stepsForPhase(owed)) {
    const blocker = blockedBy(step, outcomes);
    if (blocker) {
      outcomes.push({ step, status: "failed", error: `skipped because ${blocker} failed` });
      console.error(`[post]   ${step}: skipped, ${blocker} failed`);
      continue;
    }

    const args = STEP_COMMANDS[step](streamId, videoId);
    if (!args) {
      outcomes.push({ step, status: "ok", result: { notApplicable: true } });
      console.error(`[post]   ${step}: not applicable`);
      await writeRecord(streamId, owed, outcomes, false, attempts);
      continue;
    }

    const { ok, output } = await runScript(args);
    const result = parseStepResult(output);
    const status = judgeStep(step, ok, result);
    if (step === "saveChatLog" && typeof result?.archived === "number") {
      archived = result.archived;
    }
    outcomes.push({
      step,
      status,
      result,
      error: status === "ok" ? undefined : output.split("\n").slice(-1)[0],
    });
    console.error(
      `[post]   ${step}: ${status}${result ? ` ${JSON.stringify(result)}` : " (said nothing)"}`
    );
    await writeRecord(streamId, owed, outcomes, false, attempts);
  }

  const clean = isClean(outcomes, owed);
  let settle: { settled: boolean; note: string } | undefined;
  if (owed === "settle") {
    const outcome: SettleOutcome = clean ? settleOutcome(archived, endedAt) : "retry";
    if (outcome === "merged") {
      settle = { settled: true, note: `replay merged, ${archived} messages archived` };
    } else if (outcome === "expired") {
      settle = { settled: true, note: "no replay ever became available" };
    }
  }

  await writeRecord(streamId, owed, outcomes, true, attempts, settle);
  console.error(
    `[post] ${owed} phase for ${streamId} finished ${clean ? "clean" : "with failures"}${
      settle ? `, settled: ${settle.note}` : ""
    }`
  );
  return { ran: true, phase: owed, clean, outcomes };
}

export type OwedBroadcast = { id: string; phase: Phase; endedAt: string | null };

// A broadcast owing work. Selected by not being settled rather than by carrying
// no record, so a broadcast scored on the night is still picked up when its
// replay becomes available, and nothing has to be un-written.
export async function outstandingBroadcasts(
  nowMs: number = Date.now()
): Promise<OwedBroadcast[]> {
  const { data: ended } = await supabaseAdmin
    .from("streams")
    .select("id, ended_at")
    .eq("status", "ended")
    .order("ended_at", { ascending: false, nullsFirst: false });
  if (!ended?.length) return [];

  const { data: records } = await supabaseAdmin
    .from("broadcast_completions")
    .select("stream_id, clean, settled");
  const byStream = new Map((records ?? []).map((r) => [r.stream_id, r]));

  const owed: OwedBroadcast[] = [];
  for (const s of ended) {
    const phase = phaseOwed(byStream.get(s.id) ?? null, s.ended_at, nowMs);
    if (phase) owed.push({ id: s.id, phase, endedAt: s.ended_at });
  }
  return owed;
}

// Settling is minutes of serial work per broadcast, each step a child process
// and one of them a Claude call over the whole chat log. It runs from the
// maintenance runner, never from the live worker.
export async function catchUpEndedBroadcasts(limit = 3): Promise<{
  ran: number;
  remaining: number;
}> {
  const outstanding = await outstandingBroadcasts();
  if (!outstanding.length) return { ran: 0, remaining: 0 };

  const batch = outstanding.slice(0, limit);
  console.error(`[post] settling ${batch.length} broadcast(s)`);
  let ran = 0;
  for (const b of batch) {
    try {
      const res = await runPostBroadcastPass(b.id, b.phase);
      if (res.ran) ran += 1;
    } catch (e) {
      console.error(`[post] failed for ${b.id}:`, e);
    }
  }
  return { ran, remaining: Math.max(0, outstanding.length - batch.length) };
}

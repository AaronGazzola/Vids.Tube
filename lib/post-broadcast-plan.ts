// Which steps run, in what order, what a failure stops, and when a broadcast is
// owed work at all. Kept separate from the work itself so the rules can be
// checked without a database or a model.

export type StepName =
  | "saveChatLog"
  | "topUpChat"
  | "scoreChat"
  | "rebuildMemberships"
  | "checkLedger";

export type StepStatus = "ok" | "failed" | "unknown";

export type StepOutcome = {
  step: StepName;
  status: StepStatus;
  result?: Record<string, unknown> | null;
  error?: string;
};

// Ordered by dependency, not preference. Saving must precede the top-up because
// the top-up compares stored chat against the saved log; the top-up must precede
// scoring because scoring reads chat; scoring must precede the rebuild because
// membership totals derive from ratings.
export const STEP_ORDER: StepName[] = [
  "saveChatLog",
  "topUpChat",
  "scoreChat",
  "rebuildMemberships",
  "checkLedger",
];

// Settling a broadcast is two phases against one broadcast, not one pass.
//
// Scoring becomes ready the moment a broadcast ends, so credits and memberships
// land the same evening. It deliberately omits saveChatLog: ten minutes after a
// broadcast the YouTube replay does not exist, and fetching it anyway is what
// produced completion records claiming no gaps against an empty archive.
export type Phase = "score" | "settle";

export function stepsForPhase(phase: Phase): StepName[] {
  return phase === "score"
    ? STEP_ORDER.filter((s) => s !== "saveChatLog")
    : STEP_ORDER;
}

// A step listed here cannot run usefully if the named step failed.
const REQUIRES: Partial<Record<StepName, StepName>> = {
  rebuildMemberships: "scoreChat",
  checkLedger: "rebuildMemberships",
};

export function blockedBy(
  step: StepName,
  outcomes: StepOutcome[]
): StepName | null {
  const needs = REQUIRES[step];
  if (!needs) return null;
  const result = outcomes.find((o) => o.step === needs);
  if (!result) return null;
  return result.status === "ok" ? null : needs;
}

export function remainingSteps(outcomes: StepOutcome[]): StepName[] {
  const done = new Set(outcomes.map((o) => o.step));
  return STEP_ORDER.filter((s) => !done.has(s));
}

export function isClean(outcomes: StepOutcome[], phase: Phase = "settle"): boolean {
  const expected = stepsForPhase(phase);
  if (outcomes.length !== expected.length) return false;
  return outcomes.every((o) => o.status === "ok");
}

const num = (result: Record<string, unknown> | null, key: string): number | null => {
  const v = result?.[key];
  return typeof v === "number" ? v : null;
};

// A step is judged by what it reports having done for this broadcast, not by
// whether its process exited without an error. On 8-Aug-2026 the chat download
// printed a network failure, exited zero, saved nothing, and was recorded as
// having worked.
//
// Zero is a legitimate answer for some steps and a failure for others, so the
// rule is per step rather than shared.
export function judgeStep(
  step: StepName,
  exitedCleanly: boolean,
  result: Record<string, unknown> | null
): StepStatus {
  if (!exitedCleanly) return "failed";
  // A step that cannot say what it did has not been shown to have worked.
  if (!result) return "unknown";

  switch (step) {
    case "saveChatLog":
      // Zero archived means the replay is not downloadable, which the caller
      // decides about from the broadcast's age. Not a failure here.
      return result.failed === true ? "failed" : "ok";
    case "topUpChat": {
      const missing = num(result, "missing");
      const inserted = num(result, "inserted");
      if (missing === null || inserted === null) return "unknown";
      // A partial write is the case that must never be recorded as clean.
      return inserted < missing ? "failed" : "ok";
    }
    case "scoreChat": {
      const failed = num(result, "failed");
      if (failed === null) return "unknown";
      return failed > 0 ? "failed" : "ok";
    }
    case "rebuildMemberships": {
      const failed = num(result, "failed");
      if (failed === null) return "unknown";
      return failed > 0 ? "failed" : "ok";
    }
    case "checkLedger":
      // Saves nothing by nature, so it is judged on its own verdict alone.
      return result.ok === true ? "ok" : "failed";
  }
}

export type CompletionRecord = {
  clean: boolean;
  settled?: boolean | null;
};

// The YouTube chat replay becomes downloadable 16 to 24 hours after a broadcast.
// Twenty sits inside that window, and a sweep that guesses low costs one wasted
// fetch rather than a missed merge, because a fetch finding nothing does not
// settle the broadcast.
export const REPLAY_READY_MS = 20 * 60 * 60 * 1000;

// A replay can never arrive. The 8-Aug-2026 broadcast's fetch succeeds and
// returns nothing, seven days on. Retrying forever would keep a broadcast
// unsettled indefinitely and hide that its chat is unrecoverable.
export const REPLAY_GIVE_UP_MS = 7 * 24 * 60 * 60 * 1000;

export function phaseOwed(
  record: CompletionRecord | null,
  endedAt: string | null,
  nowMs: number = Date.now()
): Phase | null {
  if (record?.settled) return null;
  if (!record?.clean) return "score";
  if (!endedAt) return null;
  const age = nowMs - new Date(endedAt).getTime();
  return age >= REPLAY_READY_MS ? "settle" : null;
}

export type SettleOutcome = "merged" | "expired" | "retry";

export function settleOutcome(
  archived: number,
  endedAt: string | null,
  nowMs: number = Date.now()
): SettleOutcome {
  if (archived > 0) return "merged";
  if (!endedAt) return "retry";
  const age = nowMs - new Date(endedAt).getTime();
  return age >= REPLAY_GIVE_UP_MS ? "expired" : "retry";
}

export function shouldSkip(record: CompletionRecord | null): boolean {
  return !!record?.settled;
}

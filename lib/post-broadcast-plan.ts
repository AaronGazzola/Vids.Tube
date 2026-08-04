// Which steps run, in what order, and what a failure stops. Kept separate from
// the work itself so the rules can be checked without a database or a model.

export type StepName =
  | "saveChatLog"
  | "topUpChat"
  | "scoreChat"
  | "rebuildMemberships"
  | "checkLedger";

export type StepOutcome = {
  step: StepName;
  ok: boolean;
  detail?: string;
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
  return result.ok ? null : needs;
}

export function remainingSteps(outcomes: StepOutcome[]): StepName[] {
  const done = new Set(outcomes.map((o) => o.step));
  return STEP_ORDER.filter((s) => !done.has(s));
}

export function isClean(outcomes: StepOutcome[]): boolean {
  if (outcomes.length !== STEP_ORDER.length) return false;
  return outcomes.every((o) => o.ok);
}

export type CompletionRecord = {
  clean: boolean;
};

export function shouldSkip(record: CompletionRecord | null): boolean {
  return !!record?.clean;
}

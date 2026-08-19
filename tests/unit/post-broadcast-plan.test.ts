import { describe, expect, it } from "vitest";
import {
  blockedBy,
  isClean,
  phaseOwed,
  remainingSteps,
  settleOutcome,
  shouldSkip,
  STEP_ORDER,
  stepsForPhase,
  type StepOutcome,
} from "@/lib/post-broadcast-plan";

const HOUR = 60 * 60 * 1000;

const ok = (step: StepOutcome["step"]): StepOutcome => ({ step, status: "ok" });
const failed = (step: StepOutcome["step"], error = "boom"): StepOutcome => ({
  step,
  status: "failed",
  error,
});

describe("the step order", () => {
  it("saves the chat log before topping up against it", () => {
    expect(STEP_ORDER.indexOf("saveChatLog")).toBeLessThan(
      STEP_ORDER.indexOf("topUpChat")
    );
  });

  it("tops up before scoring reads the chat", () => {
    expect(STEP_ORDER.indexOf("topUpChat")).toBeLessThan(
      STEP_ORDER.indexOf("scoreChat")
    );
  });

  it("scores before rebuilding the memberships that derive from it", () => {
    expect(STEP_ORDER.indexOf("scoreChat")).toBeLessThan(
      STEP_ORDER.indexOf("rebuildMemberships")
    );
  });

  it("writes the notes last, once the totals they are written against exist", () => {
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe("writeNotes");
  });
});

describe("blockedBy", () => {
  it("stops the rebuild when scoring failed", () => {
    expect(blockedBy("rebuildMemberships", [failed("scoreChat")])).toBe("scoreChat");
  });

  it("stops the notes when the rebuild failed", () => {
    expect(blockedBy("writeNotes", [failed("rebuildMemberships")])).toBe(
      "rebuildMemberships"
    );
  });

  it("stops the ledger check when the rebuild failed", () => {
    expect(blockedBy("checkLedger", [failed("rebuildMemberships")])).toBe(
      "rebuildMemberships"
    );
  });

  it("lets scoring run when the chat log could not be fetched", () => {
    expect(blockedBy("scoreChat", [failed("saveChatLog")])).toBeNull();
  });

  it("lets the top-up run when the chat log could not be fetched", () => {
    expect(blockedBy("topUpChat", [failed("saveChatLog")])).toBeNull();
  });

  it("blocks nothing when the step it depends on succeeded", () => {
    expect(blockedBy("rebuildMemberships", [ok("scoreChat")])).toBeNull();
  });

  it("blocks nothing when the step it depends on has not run yet", () => {
    expect(blockedBy("rebuildMemberships", [])).toBeNull();
  });
});

describe("remainingSteps", () => {
  it("lists everything when nothing has run", () => {
    expect(remainingSteps([])).toEqual(STEP_ORDER);
  });

  it("lists nothing when everything has run", () => {
    expect(remainingSteps(STEP_ORDER.map(ok))).toEqual([]);
  });

  it("keeps the order of what is left", () => {
    expect(remainingSteps([ok("saveChatLog"), ok("topUpChat")])).toEqual([
      "scoreChat",
      "rebuildMemberships",
      "checkLedger",
      "writeNotes",
    ]);
  });
});

describe("isClean", () => {
  it("is clean only when every step ran and succeeded", () => {
    expect(isClean(STEP_ORDER.map(ok))).toBe(true);
  });

  it("is not clean when a step failed", () => {
    const outcomes = STEP_ORDER.map(ok);
    outcomes[0] = failed("saveChatLog");
    expect(isClean(outcomes)).toBe(false);
  });

  it("is not clean when the pass stopped early", () => {
    expect(isClean([ok("saveChatLog"), ok("topUpChat")])).toBe(false);
  });
});

describe("shouldSkip", () => {
  it("skips a broadcast whose replay has been accounted for", () => {
    expect(shouldSkip({ clean: true, settled: true })).toBe(true);
  });

  it("does not skip a broadcast scored cleanly but still owed its replay", () => {
    expect(shouldSkip({ clean: true, settled: false })).toBe(false);
  });

  it("runs a broadcast with no record at all", () => {
    expect(shouldSkip(null)).toBe(false);
  });
});

describe("stepsForPhase", () => {
  it("omits the chat log from scoring, since the replay does not exist yet", () => {
    expect(stepsForPhase("score")).not.toContain("saveChatLog");
  });

  it("scores, rebuilds, checks the ledger and writes the notes on the night", () => {
    expect(stepsForPhase("score")).toEqual([
      "topUpChat",
      "scoreChat",
      "rebuildMemberships",
      "checkLedger",
      "writeNotes",
    ]);
  });

  it("runs everything when settling", () => {
    expect(stepsForPhase("settle")).toEqual(STEP_ORDER);
  });
});

describe("phaseOwed", () => {
  const NOW = Date.parse("2026-08-15T12:00:00Z");
  const agoIso = (ms: number) => new Date(NOW - ms).toISOString();

  it("owes scoring when there is no record", () => {
    expect(phaseOwed(null, agoIso(HOUR), NOW)).toBe("score");
  });

  it("owes scoring when the record is not clean", () => {
    expect(phaseOwed({ clean: false, settled: false }, agoIso(HOUR), NOW)).toBe("score");
  });

  it("owes nothing two hours after a clean score, the replay not existing yet", () => {
    expect(phaseOwed({ clean: true, settled: false }, agoIso(2 * HOUR), NOW)).toBeNull();
  });

  it("owes settling at 21 hours, inside the window the replay appears in", () => {
    expect(phaseOwed({ clean: true, settled: false }, agoIso(21 * HOUR), NOW)).toBe(
      "settle"
    );
  });

  it("owes nothing once settled", () => {
    expect(phaseOwed({ clean: true, settled: true }, agoIso(30 * HOUR), NOW)).toBeNull();
  });
});

describe("settleOutcome", () => {
  const NOW = Date.parse("2026-08-15T12:00:00Z");
  const agoIso = (ms: number) => new Date(NOW - ms).toISOString();

  it("is merged when the replay held messages", () => {
    expect(settleOutcome(13, agoIso(21 * HOUR), NOW)).toBe("merged");
  });

  it("retries when the replay held nothing and the broadcast is recent", () => {
    expect(settleOutcome(0, agoIso(2 * 24 * HOUR), NOW)).toBe("retry");
  });

  it("expires when nothing has come back after seven days", () => {
    expect(settleOutcome(0, agoIso(8 * 24 * HOUR), NOW)).toBe("expired");
  });

  it("counts an empty replay as merged never, however old, if it held messages", () => {
    expect(settleOutcome(1, agoIso(30 * 24 * HOUR), NOW)).toBe("merged");
  });
});

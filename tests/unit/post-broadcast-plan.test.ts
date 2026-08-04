import { describe, expect, it } from "vitest";
import {
  blockedBy,
  isClean,
  remainingSteps,
  shouldSkip,
  STEP_ORDER,
  type StepOutcome,
} from "@/lib/post-broadcast-plan";

const ok = (step: StepOutcome["step"]): StepOutcome => ({ step, ok: true });
const failed = (step: StepOutcome["step"], error = "boom"): StepOutcome => ({
  step,
  ok: false,
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

  it("checks the ledger last, once the totals it checks exist", () => {
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe("checkLedger");
  });
});

describe("blockedBy", () => {
  it("stops the rebuild when scoring failed", () => {
    expect(blockedBy("rebuildMemberships", [failed("scoreChat")])).toBe("scoreChat");
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
  it("skips a broadcast that already completed cleanly", () => {
    expect(shouldSkip({ clean: true })).toBe(true);
  });

  it("retries a broadcast whose pass was not clean", () => {
    expect(shouldSkip({ clean: false })).toBe(false);
  });

  it("runs a broadcast with no record at all", () => {
    expect(shouldSkip(null)).toBe(false);
  });
});

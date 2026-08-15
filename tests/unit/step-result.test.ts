import { judgeStep } from "@/lib/post-broadcast-plan";
import { formatStepResult, parseStepResult } from "@/lib/step-result";
import { describe, expect, it } from "vitest";

describe("parseStepResult", () => {
  it("reads a result from the end of a script's output", () => {
    const output = ["broadcasts checked: 1", formatStepResult({ inserted: 4 })].join("\n");
    expect(parseStepResult(output)).toEqual({ inserted: 4 });
  });

  it("takes the last result, since a later line is the conclusion", () => {
    const output = [
      formatStepResult({ inserted: 1 }),
      "still working",
      formatStepResult({ inserted: 9 }),
    ].join("\n");
    expect(parseStepResult(output)).toEqual({ inserted: 9 });
  });

  it("returns nothing when the script said nothing", () => {
    expect(parseStepResult("archived abc: 0 messages\ndone")).toBeNull();
  });

  it("falls back past a malformed line rather than treating the step as silent", () => {
    const output = [formatStepResult({ inserted: 2 }), "::result {not json"].join("\n");
    expect(parseStepResult(output)).toEqual({ inserted: 2 });
  });

  it("ignores a result that is not an object", () => {
    expect(parseStepResult("::result [1,2,3]")).toBeNull();
  });

  it("survives carriage returns, since these come back from a Windows shell", () => {
    expect(parseStepResult(`done\r\n${formatStepResult({ ok: true })}\r\n`)).toEqual({
      ok: true,
    });
  });
});

describe("judgeStep", () => {
  it("fails anything that exited badly, whatever it claimed", () => {
    expect(judgeStep("topUpChat", false, { missing: 0, inserted: 0 })).toBe("failed");
  });

  it("calls a silent step unknown rather than crediting it", () => {
    // 8-Aug-2026: the chat download printed a network failure, exited zero and
    // saved nothing, and was recorded as having worked.
    expect(judgeStep("saveChatLog", true, null)).toBe("unknown");
    expect(judgeStep("checkLedger", true, null)).toBe("unknown");
  });

  it("accepts an empty chat replay, which means it is not downloadable yet", () => {
    expect(judgeStep("saveChatLog", true, { archived: 0, failed: false })).toBe("ok");
  });

  it("fails the chat log when the script says it failed", () => {
    expect(judgeStep("saveChatLog", true, { archived: 0, failed: true })).toBe("failed");
  });

  it("fails a partial top-up, which must never be recorded as clean", () => {
    expect(judgeStep("topUpChat", true, { missing: 13, inserted: 9 })).toBe("failed");
  });

  it("passes a complete top-up", () => {
    expect(judgeStep("topUpChat", true, { missing: 13, inserted: 13 })).toBe("ok");
  });

  it("passes a top-up with nothing to do", () => {
    expect(judgeStep("topUpChat", true, { missing: 0, inserted: 0 })).toBe("ok");
  });

  it("is unknown when a count it needs is absent", () => {
    expect(judgeStep("topUpChat", true, { inserted: 3 })).toBe("unknown");
    expect(judgeStep("scoreChat", true, { scored: 3 })).toBe("unknown");
  });

  it("fails scoring when any batch failed", () => {
    expect(judgeStep("scoreChat", true, { scored: 20, failed: 1 })).toBe("failed");
  });

  it("passes scoring that scored nothing because there was nothing to score", () => {
    expect(judgeStep("scoreChat", true, { scored: 0, failed: 0 })).toBe("ok");
  });

  it("judges the ledger on its own verdict, since it saves nothing", () => {
    expect(judgeStep("checkLedger", true, { ok: true })).toBe("ok");
    expect(judgeStep("checkLedger", true, { ok: false })).toBe("failed");
  });
});

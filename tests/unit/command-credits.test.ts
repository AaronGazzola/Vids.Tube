import { insufficientReply, shouldCharge } from "@/worker/lib/credits";
import { MAX_GREETING_CHARS } from "@/worker/lib/chatter-greeting";
import { describe, expect, it } from "vitest";

describe("shouldCharge", () => {
  it("charges a chatter for a priced command", () => {
    expect(shouldCharge({ credit_cost: 1 }, { isHost: false })).toBe(true);
  });

  it("leaves a free command free, which is every command by default", () => {
    // Nothing is looked up when this is false, so the free path costs exactly
    // what it costs today: no membership lookup, no ledger call.
    expect(shouldCharge({ credit_cost: 0 }, { isHost: false })).toBe(false);
  });

  it("never charges the host, whatever the price", () => {
    expect(shouldCharge({ credit_cost: 99 }, { isHost: true })).toBe(false);
  });

  it("treats an absent host flag as a chatter", () => {
    expect(shouldCharge({ credit_cost: 1 }, {})).toBe(true);
  });
});

describe("insufficientReply", () => {
  it("names the price and the balance", () => {
    const text = insufficientReply({
      mention: "@ava",
      keyword: "tts",
      amount: 1,
      balance: 0,
    });
    expect(text).toContain("@ava");
    expect(text).toContain("!tts");
    expect(text).toContain("1 credit");
    expect(text).toContain("you have 0");
  });

  it("pluralises the price", () => {
    const text = insufficientReply({
      mention: "@ava",
      keyword: "tts",
      amount: 3,
      balance: 1,
    });
    expect(text).toContain("3 credits");
  });

  it("reads a missing membership as a balance of nothing", () => {
    const text = insufficientReply({
      mention: "@ava",
      keyword: "tts",
      amount: 1,
      balance: null,
    });
    expect(text).toContain("you have 0");
  });

  it("fits YouTube's limit however long the name is", () => {
    const text = insufficientReply({
      mention: `@${"a".repeat(400)}`,
      keyword: "tts",
      amount: 1,
      balance: 0,
    });
    expect(text.length).toBeLessThanOrEqual(MAX_GREETING_CHARS);
    // The price and the balance are what the chatter needs; only the name gives
    // way.
    expect(text).toContain("!tts costs 1 credit");
    expect(text).toContain("you have 0");
  });
});

import { describe, expect, it } from "vitest";
import { creditsForXp } from "@/lib/credits";

describe("creditsForXp", () => {
  it("gives nothing below the first whole credit", () => {
    expect(creditsForXp(0)).toBe(0);
    expect(creditsForXp(9)).toBe(0);
  });

  it("gives one credit per ten experience", () => {
    expect(creditsForXp(10)).toBe(1);
    expect(creditsForXp(19)).toBe(1);
    expect(creditsForXp(20)).toBe(2);
  });

  it("matches the top chatter's current standing", () => {
    expect(creditsForXp(1640)).toBe(164);
  });

  it("never returns a negative balance", () => {
    expect(creditsForXp(-500)).toBe(0);
  });

  it("treats a missing total as nothing earned", () => {
    expect(creditsForXp(null)).toBe(0);
    expect(creditsForXp(undefined)).toBe(0);
  });
});

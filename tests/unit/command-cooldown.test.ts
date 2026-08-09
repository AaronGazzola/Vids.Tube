import { describe, expect, it } from "vitest";
import { cooldownWaitSeconds } from "@/worker/lib/commands";

const LAST = "2026-08-09T13:23:09.000Z";
const at = (iso: string) => new Date(iso).getTime();

describe("cooldownWaitSeconds", () => {
  it("counts the remainder of the window, rounded up", () => {
    expect(cooldownWaitSeconds(LAST, 180, at("2026-08-09T13:24:51.000Z"))).toBe(
      78
    );
  });

  it("never tells a chatter to wait zero or less", () => {
    expect(cooldownWaitSeconds(LAST, 180, at("2026-08-09T13:30:00.000Z"))).toBe(
      1
    );
  });
});

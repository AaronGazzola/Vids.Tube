import { resolveDwell, resolveGlobalDwell } from "@/lib/banner-dwell";
import {
  OVERLAY_MESSAGE_DWELL_MAX_MS,
  OVERLAY_MESSAGE_DWELL_MIN_MS,
  OVERLAY_MESSAGE_DWELL_MS,
} from "@/lib/demo-overlay";
import { describe, expect, it } from "vitest";

describe("resolveDwell", () => {
  it("takes the global when the message carries no time of its own", () => {
    expect(resolveDwell({ }, 9000)).toBe(9000);
    expect(resolveDwell(undefined, 9000)).toBe(9000);
  });

  it("prefers the message's own time", () => {
    expect(resolveDwell({ dwellMs: 3000 }, 9000)).toBe(3000);
  });

  it("keeps a message pinned when its own time equals the current global", () => {
    const own = { dwellMs: 6000 };
    const unset = {};
    expect(resolveDwell(own, 6000)).toBe(6000);
    expect(resolveDwell(unset, 6000)).toBe(6000);
    // The global moves. Only the message that never had a time of its own moves
    // with it.
    expect(resolveDwell(own, 20000)).toBe(6000);
    expect(resolveDwell(unset, 20000)).toBe(20000);
  });

  it("ignores an unusable own time and falls back to the global", () => {
    const global = 9000;
    for (const bad of [
      0,
      -1,
      OVERLAY_MESSAGE_DWELL_MIN_MS - 1,
      OVERLAY_MESSAGE_DWELL_MAX_MS + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(resolveDwell({ dwellMs: bad }, global)).toBe(global);
    }
    expect(
      resolveDwell({ dwellMs: "6000" as unknown as number }, global)
    ).toBe(global);
  });

  it("accepts a time exactly on either bound", () => {
    expect(resolveDwell({ dwellMs: OVERLAY_MESSAGE_DWELL_MIN_MS }, 9000)).toBe(
      OVERLAY_MESSAGE_DWELL_MIN_MS
    );
    expect(resolveDwell({ dwellMs: OVERLAY_MESSAGE_DWELL_MAX_MS }, 9000)).toBe(
      OVERLAY_MESSAGE_DWELL_MAX_MS
    );
  });

  it("falls back to the default when the global itself is unusable", () => {
    expect(resolveDwell({}, 0)).toBe(OVERLAY_MESSAGE_DWELL_MS);
    expect(resolveDwell({}, undefined)).toBe(OVERLAY_MESSAGE_DWELL_MS);
    expect(resolveGlobalDwell(Number.NaN)).toBe(OVERLAY_MESSAGE_DWELL_MS);
  });
});

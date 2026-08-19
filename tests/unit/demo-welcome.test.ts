import { useDemoGeneratorStore } from "@/app/(app)/live/demo.stores";
import { beforeEach, describe, expect, it } from "vitest";

describe("playWelcome", () => {
  beforeEach(() => useDemoGeneratorStore.getState().seed());

  it("appends a welcome whose authors match its kind", () => {
    const before = useDemoGeneratorStore.getState().welcomes.length;
    for (let i = 0; i < 20; i++) useDemoGeneratorStore.getState().playWelcome();
    const welcomes = useDemoGeneratorStore.getState().welcomes;
    const added = welcomes.slice(-Math.min(20, welcomes.length));

    expect(welcomes.length).toBeGreaterThan(before);
    expect(new Set(welcomes.map((w) => w.id)).size).toBe(welcomes.length);
    for (const w of added) {
      expect(w.viewerKeys.length).toBe(w.kind === "batch" ? 3 : 1);
      expect(w.viewerKeys.every((k) => k.length > 0)).toBe(true);
    }
  });
});

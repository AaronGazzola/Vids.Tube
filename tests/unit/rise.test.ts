import { riseStep } from "@/lib/rise";
import { describe, expect, it } from "vitest";

// Replays a sequence of values through the step and reports which of them
// counted as a rise, which is exactly what the animation keys on.
function replay(values: unknown[]): boolean[] {
  let baseline: number | null = null;
  return values.map((v) => {
    const step = riseStep(baseline, v);
    baseline = step.baseline;
    return step.rose;
  });
}

describe("riseStep", () => {
  it("is silent on the first value", () => {
    expect(replay([40])).toEqual([false]);
  });

  it("reports a rise", () => {
    expect(replay([40, 41])).toEqual([false, true]);
  });

  it("is silent when the value does not change", () => {
    expect(replay([40, 40, 40])).toEqual([false, false, false]);
  });

  it("is silent on a fall, but rebases to it", () => {
    // 12 → 9 is silent; 9 → 10 is a rise even though 10 is below the old 12.
    expect(replay([12, 9, 10])).toEqual([false, false, true]);
  });

  it("counts a jump of several as one rise", () => {
    expect(replay([40, 50])).toEqual([false, true]);
  });

  it("ignores a value that is not a usable number", () => {
    expect(replay([40, null, 41])).toEqual([false, false, true]);
    expect(replay([40, Number.NaN, 41])).toEqual([false, false, true]);
    expect(replay([40, undefined, 39])).toEqual([false, false, false]);
  });

  it("treats arriving after nothing as arrival rather than a rise", () => {
    expect(replay([null, undefined, 0])).toEqual([false, false, false]);
    expect(replay([null, undefined, 0, 1])).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });
});

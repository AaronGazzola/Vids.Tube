import { describe, expect, it } from "vitest";
import {
  parseSettingsFields,
  parseSettingsValues,
  resolveSettings,
  validateSettingsWrite,
  type OverlaySettingsField,
} from "@/lib/overlay-settings";

const SCALE: OverlaySettingsField = {
  key: "creatureScale",
  label: "Creature size",
  type: "number",
  default: 1,
  min: 0.5,
  max: 2,
  step: 0.1,
};
const LOUD: OverlaySettingsField = {
  key: "chime",
  label: "Chime",
  type: "toggle",
  default: false,
};
const MOOD: OverlaySettingsField = {
  key: "mood",
  label: "Mood",
  type: "choice",
  options: [
    { value: "calm", label: "Calm" },
    { value: "lively", label: "Lively" },
  ],
};

describe("parsing a declaration an overlay wrote", () => {
  it("keeps the good entries and drops the bad ones", () => {
    const fields = parseSettingsFields([
      SCALE,
      { key: "no-label", type: "number" },
      { key: "1bad", label: "Bad key", type: "number" },
      { key: "unknown", label: "Unknown type", type: "matrix" },
      "not an object",
      LOUD,
    ]);
    expect(fields.map((f) => f.key)).toEqual(["creatureScale", "chime"]);
  });

  it("drops a duplicate key rather than letting the second win", () => {
    const fields = parseSettingsFields([SCALE, { ...SCALE, label: "Again" }]);
    expect(fields).toHaveLength(1);
    expect(fields[0].label).toBe("Creature size");
  });

  it("drops a choice with no options, which could not be rendered", () => {
    expect(parseSettingsFields([{ ...MOOD, options: [] }])).toHaveLength(0);
    expect(parseSettingsFields([MOOD])).toHaveLength(1);
  });

  it("treats a declaration that is not a list as no declaration", () => {
    expect(parseSettingsFields(null)).toEqual([]);
    expect(parseSettingsFields({ key: "x" })).toEqual([]);
  });

  it("keeps only values of a usable kind", () => {
    expect(
      parseSettingsValues({ a: 1, b: true, c: "x", d: null, e: { f: 1 } })
    ).toEqual({ a: 1, b: true, c: "x" });
  });
});

describe("resolving what an overlay reads", () => {
  it("fills an unset field with its declared default", () => {
    expect(resolveSettings([SCALE, LOUD], {})).toEqual({
      creatureScale: 1,
      chime: false,
    });
  });

  it("does not overwrite what the streamer set", () => {
    expect(resolveSettings([SCALE], { creatureScale: 1.5 })).toEqual({
      creatureScale: 1.5,
    });
  });

  it("leaves a declared field with no default absent rather than inventing one", () => {
    expect(resolveSettings([MOOD], {})).toEqual({});
  });
});

describe("what may be written", () => {
  it("accepts a value inside its declared range", () => {
    const result = validateSettingsWrite([SCALE], { creatureScale: 1.5 });
    expect(result).toEqual({ ok: true, values: { creatureScale: 1.5 } });
  });

  it("refuses a number above its maximum", () => {
    const result = validateSettingsWrite([SCALE], { creatureScale: 3 });
    expect(result.ok).toBe(false);
  });

  it("refuses a number off its declared step", () => {
    expect(validateSettingsWrite([SCALE], { creatureScale: 1.23 }).ok).toBe(
      false
    );
  });

  // A slider at 0.7 with a step of 0.1 lands a hair off a whole number of steps.
  // Refusing that would refuse the editor's own output.
  it("accepts the floating point a slider actually produces", () => {
    expect(validateSettingsWrite([SCALE], { creatureScale: 0.7 }).ok).toBe(true);
    expect(
      validateSettingsWrite([SCALE], { creatureScale: 0.5 + 0.1 + 0.1 }).ok
    ).toBe(true);
  });

  it("refuses a key the overlay does not declare", () => {
    expect(validateSettingsWrite([SCALE], { somethingElse: 1 }).ok).toBe(false);
  });

  it("refuses a choice outside its options", () => {
    expect(validateSettingsWrite([MOOD], { mood: "furious" }).ok).toBe(false);
    expect(validateSettingsWrite([MOOD], { mood: "calm" }).ok).toBe(true);
  });

  it("refuses a value of the wrong kind", () => {
    expect(validateSettingsWrite([LOUD], { chime: "yes" }).ok).toBe(false);
    expect(validateSettingsWrite([SCALE], { creatureScale: "1" }).ok).toBe(false);
  });

  it("stores any finite number where no range is declared", () => {
    const free: OverlaySettingsField = {
      key: "depth",
      label: "Depth",
      type: "number",
    };
    expect(validateSettingsWrite([free], { depth: -9999.5 }).ok).toBe(true);
  });

  it("refuses text over the ceiling", () => {
    const name: OverlaySettingsField = {
      key: "name",
      label: "Name",
      type: "text",
    };
    expect(validateSettingsWrite([name], { name: "a".repeat(501) }).ok).toBe(
      false
    );
    expect(validateSettingsWrite([name], { name: "a".repeat(500) }).ok).toBe(
      true
    );
  });

  // Written and stored are different questions.
  it("carries forward a stored value the overlay no longer declares", () => {
    const result = validateSettingsWrite(
      [SCALE],
      { creatureScale: 1 },
      { retired: "kept", creatureScale: 2 }
    );
    expect(result).toEqual({
      ok: true,
      values: { retired: "kept", creatureScale: 1 },
    });
  });

  it("refuses anything that is not an object", () => {
    expect(validateSettingsWrite([SCALE], null).ok).toBe(false);
    expect(validateSettingsWrite([SCALE], [1, 2]).ok).toBe(false);
  });
});

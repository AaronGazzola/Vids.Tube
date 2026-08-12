// @vitest-environment happy-dom
import { DEFAULT_DEMO_LAYOUT } from "@/app/(app)/live/demo.types";
import { OverlayStage } from "@/components/overlay/overlay-stage";
import type { OverlayStageValues } from "@/components/overlay/overlay-stage.types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const CONFIG = DEFAULT_DEMO_LAYOUT;

const METRIC = {
  current: 12,
  target: 100,
  total: 12,
  goal: 100,
  pct: 0.12,
  reached: false,
};

function values(overrides: Partial<OverlayStageValues> = {}): OverlayStageValues {
  return {
    feedVisible: true,
    feedSlot: <div data-testid="feed">a real highlight</div>,
    feedSlotFilled: true,
    memberCount: 143,
    goalMetric: () => METRIC,
    competitionEntries: [],
    breakSlot: null,
    ...overrides,
  };
}

function render(
  surface: "obs" | "composer",
  overrides: Partial<OverlayStageValues> = {}
) {
  return renderToStaticMarkup(
    <OverlayStage
      config={CONFIG}
      boxes={CONFIG.boxes}
      visible={CONFIG.visible}
      surface={surface}
      values={values(overrides)}
    />
  );
}

// The root wrapper is the one deliberate difference: the audience surface is a
// fixed full-viewport frame, the composer sits inside a scaled canvas. Below the
// root the two must be byte-identical, which is the property the single renderer
// exists to guarantee.
function body(markup: string): string {
  return markup.replace(
    /^<div class="[^"]*" style="width:1080px;height:1920px">/,
    ""
  );
}

describe("OverlayStage parity across surfaces", () => {
  it("renders identical content from the same values when the feed is filled", () => {
    expect(body(render("composer"))).toBe(body(render("obs")));
  });

  it("differs only by the placeholder when the feed is empty", () => {
    const empty = { feedSlot: null, feedSlotFilled: false };
    const obs = body(render("obs", empty));
    const composer = body(render("composer", empty));

    expect(obs).not.toBe(composer);
    expect(obs).not.toContain("Highlight");
    expect(composer).toContain("Highlight");
    expect(composer.replace(/<div class="flex h-24[\s\S]*?<\/div>/, "")).toBe(
      obs
    );
  });

  it("puts the audience surface in fixed position and the composer in the canvas", () => {
    expect(render("obs")).toContain("fixed");
    expect(render("composer")).not.toContain("fixed");
  });

  it("carries the real member count onto both surfaces", () => {
    expect(render("obs")).toContain("143");
    expect(render("composer")).toContain("143");
  });
});

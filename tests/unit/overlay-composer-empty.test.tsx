// @vitest-environment happy-dom
import {
  DEFAULT_DEMO_LAYOUT,
  DEMO_GOAL_TARGETS,
  DEMO_MEMBER_COUNT,
} from "@/app/(app)/live/demo.types";
import { OverlayStage } from "@/components/overlay/overlay-stage";
import type { OverlayStageValues } from "@/components/overlay/overlay-stage.types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const CONFIG = DEFAULT_DEMO_LAYOUT;

// What the composer hands the renderer when no broadcast is live: no goal
// metrics, nobody scored, no feed item, no break. Nothing stands in for them.
const EMPTY: OverlayStageValues = {
  feedVisible: true,
  feedSlot: null,
  feedSlotFilled: false,
  memberCount: 0,
  goalMetric: () => null,
  competitionEntries: [],
  breakSlot: null,
};

function renderEmpty() {
  return renderToStaticMarkup(
    <OverlayStage
      config={CONFIG}
      boxes={CONFIG.boxes}
      visible={CONFIG.visible}
      surface="composer"
      values={EMPTY}
    />
  );
}

describe("the Overlays tab with nothing live", () => {
  it("renders no goal bar at all rather than an idle or invented one", () => {
    const markup = renderEmpty();
    expect(markup).not.toContain("ring-track-subs");
    expect(markup).not.toContain("ring-track-likes");
    expect(markup).not.toContain("ring-track-viewers");
  });

  it("shows a zero member count, not the demo count", () => {
    const markup = renderEmpty();
    expect(markup).toContain(">0<");
    expect(markup).not.toContain(`>${DEMO_MEMBER_COUNT}<`);
  });

  it("renders no leaderboard when nobody has scored", () => {
    expect(renderEmpty()).not.toContain("rainbow-ring");
  });

  it("shows the empty feed placeholder rather than a demo highlight", () => {
    expect(renderEmpty()).toContain("Highlight");
  });

  it("carries no demo goal target into the markup", () => {
    const markup = renderEmpty();
    for (const target of Object.values(DEMO_GOAL_TARGETS)) {
      expect(markup).not.toContain(`>${target}<`);
    }
  });
});

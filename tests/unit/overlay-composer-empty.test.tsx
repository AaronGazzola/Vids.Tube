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

const SAVED_TARGET = 250;

// What the composer hands the renderer when no broadcast is live: goals at zero
// against the owner's saved targets, nobody scored, no feed item, no break.
// Nothing is invented, and nothing is hidden merely for being empty.
const EMPTY: OverlayStageValues = {
  feedVisible: true,
  feedSlot: null,
  feedSlotFilled: false,
  bannerMetrics: {
    totalSubs: null,
    newSubsThisStream: null,
    likesThisStream: null,
    currentViewers: null,
    totalChatters: 0,
    totalCommands: 0,
    members: 0,
    newMembersThisStream: null,
  },
  goalMetric: () => ({
    current: 0,
    target: SAVED_TARGET,
    total: 0,
    goal: SAVED_TARGET,
    pct: 0,
    reached: false,
  }),
  competitionEntries: [],
  breakSlot: null,
};

function renderEmpty(resizeMode = false) {
  return renderToStaticMarkup(
    <OverlayStage
      config={CONFIG}
      boxes={CONFIG.boxes}
      visible={CONFIG.visible}
      surface="composer"
      values={EMPTY}
      resizeMode={resizeMode}
    />
  );
}

describe("the Overlays tab with nothing live", () => {
  it("renders every goal bar, at zero, so they can be positioned", () => {
    const markup = renderEmpty();
    expect(markup).toContain("ring-track-subs");
    expect(markup).toContain("ring-track-likes");
    expect(markup).toContain("ring-track-viewers");
  });

  it("draws the goal bars against the saved target, not a demo one", () => {
    const markup = renderEmpty();
    for (const target of Object.values(DEMO_GOAL_TARGETS)) {
      expect(markup).not.toContain(`>${target}<`);
    }
  });

  it("shows a zero member count, not the demo count", () => {
    const markup = renderEmpty();
    expect(markup).toContain(">0<");
    expect(markup).not.toContain(`>${DEMO_MEMBER_COUNT}<`);
  });

  it("renders the leaderboard frame even with nobody scored", () => {
    expect(renderEmpty()).toContain("competition-ladder");
  });

  it("hides the idle highlight placeholder while not positioning", () => {
    expect(renderEmpty()).not.toContain("Highlight");
  });

  it("shows the highlight placeholder once resize mode is on", () => {
    expect(renderEmpty(true)).toContain("Highlight");
  });
});

// @vitest-environment happy-dom
import { DEFAULT_DEMO_LAYOUT } from "@/app/(app)/live/demo.types";
import { OverlayStage } from "@/components/overlay/overlay-stage";
import { WelcomeCard } from "@/components/overlay/welcome-card";
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
    bannerMetrics: {
      totalSubs: 4820,
      newSubsThisStream: 37,
      likesThisStream: 214,
      currentViewers: 63,
      chattersThisStream: 84,
      chatsThisStream: 1180,
    commandsThisStream: 96,
      members: 143,
      newMembersThisStream: 9,
    },
    goalMetric: () => METRIC,
    // Non-empty by default, so the identity check compares two populated
    // stages. Emptiness is a deliberate difference and is asserted separately.
    competitionEntries: [
      { key: "someone", author: null, score: 12 },
    ],
    breakSlot: null,
    gameInstallation: null,
    ...overrides,
  };
}

function render(
  surface: "obs" | "composer",
  overrides: Partial<OverlayStageValues> = {},
  resizeMode = false
) {
  return renderToStaticMarkup(
    <OverlayStage
      config={CONFIG}
      boxes={CONFIG.boxes}
      visible={CONFIG.visible}
      surface={surface}
      values={values(overrides)}
      resizeMode={resizeMode}
    />
  );
}

const EMPTY: Partial<OverlayStageValues> = {
  feedSlot: null,
  feedSlotFilled: false,
  competitionEntries: [],
};

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

  // The one place the surfaces are meant to differ: the composer shows what is
  // there including nothing, and the audience is never shown an empty frame.
  it("shows an empty leaderboard on the composer and none on the audience surface", () => {
    expect(body(render("composer", EMPTY))).toContain("competition-ladder");
    expect(body(render("obs", EMPTY))).not.toContain("competition-ladder");
  });

  it("renders a zero goal bar on both surfaces, since zero is a real value", () => {
    expect(body(render("composer", EMPTY))).toContain("ring-track-subs");
    expect(body(render("obs", EMPTY))).toContain("ring-track-subs");
  });

  it("keeps the idle placeholder off both surfaces until positioning starts", () => {
    expect(body(render("composer", EMPTY))).not.toContain("Highlight");
    expect(body(render("obs", EMPTY))).not.toContain("Highlight");
  });

  it("shows the placeholder only on the composer, and only while resizing", () => {
    expect(body(render("composer", EMPTY, true))).toContain("Highlight");
    expect(body(render("obs", EMPTY, true))).not.toContain("Highlight");
  });

  it("puts the audience surface in fixed position and the composer in the canvas", () => {
    expect(render("obs")).toContain("fixed");
    expect(render("composer")).not.toContain("fixed");
  });

  it("carries the real member count onto both surfaces", () => {
    expect(render("obs")).toContain("143");
    expect(render("composer")).toContain("143");
  });

  // Paint order is document order: the boxes are absolutely positioned siblings
  // with no z-index between them, so the game being drawn first is the whole of
  // it sitting behind everything else.
  it("draws the game box before every other overlay, on both surfaces", () => {
    for (const surface of ["obs", "composer"] as const) {
      // The game is off by default, so it has to be switched on to be ordered.
      const markup = renderToStaticMarkup(
        <OverlayStage
          config={CONFIG}
          boxes={CONFIG.boxes}
          visible={{ ...CONFIG.visible, game: true }}
          surface={surface}
          values={values()}
        />
      );
      const game = markup.indexOf('data-testid="overlay-box-game"');
      expect(game).toBeGreaterThan(-1);
      for (const other of [
        "overlay-box-highlight",
        "overlay-box-messageBanner",
        "overlay-box-goalSubs",
        "overlay-box-competition",
      ]) {
        expect(markup.indexOf(`data-testid="${other}"`)).toBeGreaterThan(game);
      }
    }
  });
});

describe("the welcome card draws the same on both surfaces", () => {
  const WELCOME = {
    feedSlot: (
      <WelcomeCard
        kind="new"
        authors={[
          { name: "Ava", handle: "ava", avatarUrl: null, avatarPath: null },
        ]}
        onDone={() => {}}
      />
    ),
  };

  it("draws it identically wherever the feed slot is drawn", () => {
    expect(body(render("obs", WELCOME))).toBe(
      body(render("composer", WELCOME))
    );
  });

  it("names the new member on the audience surface", () => {
    const drawn = body(render("obs", WELCOME));
    expect(drawn).toContain("New member");
    expect(drawn).toContain("@ava");
  });
});

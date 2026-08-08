import type { Counts } from "@/lib/goals";

export type DemoBoxKey =
  | "members"
  | "goalLikes"
  | "goalViewers"
  | "competition"
  | "highlight"
  | "break";
export type DemoOverlayKey = DemoBoxKey | "tts" | "ask";
export type DemoBackground = "slideshow" | "gradient" | "black";

export type DemoBox = { x: number; y: number; scale: number };

// Bumped when the meaning of box coordinates changes; saved layouts from an
// older version keep their toggles but fall back to the default boxes.
// v3 replaced the square subscriber-goal box with the wide members strip, whose
// coordinates mean something different, so v2 layouts must not inherit them.
export const DEMO_LAYOUT_VERSION = 3;

export type OverlayFeedSound = "chime" | "off";

export type DemoLayoutConfig = {
  version: number;
  boxes: Record<DemoBoxKey, DemoBox>;
  visible: Record<DemoOverlayKey, boolean>;
  goalProgressFull: boolean;
  background: DemoBackground;
  mobileChrome: boolean;
  boxOpacity: Record<DemoBoxKey, number>;
  feedSound: OverlayFeedSound;
};

export const DEMO_OVERLAY_KEYS: DemoOverlayKey[] = [
  "members",
  "goalLikes",
  "goalViewers",
  "competition",
  "highlight",
  "tts",
  "ask",
  "break",
];

export const DEMO_OVERLAY_LABELS: Record<DemoOverlayKey, string> = {
  members: "Members",
  goalLikes: "Likes goal",
  goalViewers: "Viewers goal",
  competition: "Competition",
  highlight: "Highlight",
  tts: "TTS card",
  ask: "!ask exchange",
  break: "Break timer",
};

// Box coordinates live on the 1080x1920 vertical stream canvas, so a saved
// layout renders identically in the preview and in a full-canvas OBS source.
export const DEFAULT_DEMO_LAYOUT: DemoLayoutConfig = {
  version: DEMO_LAYOUT_VERSION,
  boxes: {
    // Centred across the top at scale 1: 810 wide on a 1080 canvas leaves 135
    // either side, so the strip reads as a banner rather than a floating box.
    members: { x: 135, y: 56, scale: 1 },
    goalLikes: { x: 48, y: 380, scale: 2 },
    goalViewers: { x: 700, y: 64, scale: 2 },
    competition: { x: 48, y: 720, scale: 2 },
    highlight: { x: 120, y: 1260, scale: 2 },
    break: { x: 220, y: 860, scale: 2 },
  },
  visible: {
    members: true,
    goalLikes: true,
    goalViewers: true,
    competition: true,
    highlight: true,
    tts: true,
    ask: true,
    break: false,
  },
  goalProgressFull: false,
  background: "slideshow",
  mobileChrome: false,
  boxOpacity: {
    members: 1,
    goalLikes: 1,
    goalViewers: 1,
    competition: 0.6,
    highlight: 1,
    break: 1,
  },
  feedSound: "chime",
};

// The counts the demo drives its goal bars toward. Real saved targets are layered
// over these at render time; these are only the fallback when none are set.
export const DEMO_GOAL_TARGETS: Counts = { subs: 1000, likes: 500, viewers: 100 };

// Sample figure for the layout preview, which runs on generated data rather than
// the live community.
export const DEMO_MEMBER_COUNT = 143;

// Saved layouts from before per-overlay opacity carry a single
// `competitionOpacity` number; it migrates into `boxOpacity.competition`.
type LegacyDemoLayoutConfig = Partial<DemoLayoutConfig> & {
  competitionOpacity?: number;
};

export const DEMO_BOX_KEYS: DemoBoxKey[] = [
  "members",
  "goalLikes",
  "goalViewers",
  "competition",
  "highlight",
  "break",
];

// A version bump used to throw away every saved position, which cost the owner
// their whole layout every time an overlay changed. Positions are hard-won and
// are never discarded wholesale again.
//
// A version lists only the boxes whose coordinates genuinely changed meaning at
// that version; every other box carries its saved position forward. A box that
// is new, or that was never saved, takes its default.
const RESET_AT_VERSION: Record<number, DemoBoxKey[]> = {
  // v3 introduced the members strip and removed the subscriber goal box.
  // Nothing that survived the change moved, so nothing is reset.
  3: [],
};

function isBox(value: unknown): value is DemoBox {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Partial<DemoBox>;
  return (
    Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.scale)
  );
}

function keysResetSince(savedVersion: number | undefined): Set<DemoBoxKey> {
  const from = Number.isFinite(savedVersion)
    ? (savedVersion as number)
    : DEMO_LAYOUT_VERSION;
  const reset = new Set<DemoBoxKey>();
  for (let v = from + 1; v <= DEMO_LAYOUT_VERSION; v += 1) {
    for (const key of RESET_AT_VERSION[v] ?? []) reset.add(key);
  }
  return reset;
}

export function mergeDemoLayout(
  partial: LegacyDemoLayoutConfig | null | undefined
): DemoLayoutConfig {
  if (!partial) return DEFAULT_DEMO_LAYOUT;

  const reset = keysResetSince(partial.version);
  const saved = (partial.boxes ?? {}) as Partial<Record<DemoBoxKey, unknown>>;
  const boxes = {} as Record<DemoBoxKey, DemoBox>;
  for (const key of DEMO_BOX_KEYS) {
    const value = saved[key];
    boxes[key] =
      !reset.has(key) && isBox(value) ? value : DEFAULT_DEMO_LAYOUT.boxes[key];
  }

  return {
    version: DEMO_LAYOUT_VERSION,
    boxes,
    visible: { ...DEFAULT_DEMO_LAYOUT.visible, ...(partial.visible ?? {}) },
    goalProgressFull:
      partial.goalProgressFull ?? DEFAULT_DEMO_LAYOUT.goalProgressFull,
    background: partial.background ?? DEFAULT_DEMO_LAYOUT.background,
    mobileChrome: partial.mobileChrome ?? DEFAULT_DEMO_LAYOUT.mobileChrome,
    boxOpacity: {
      ...DEFAULT_DEMO_LAYOUT.boxOpacity,
      ...(partial.competitionOpacity !== undefined
        ? { competition: partial.competitionOpacity }
        : {}),
      ...(partial.boxOpacity ?? {}),
    },
    feedSound: partial.feedSound ?? DEFAULT_DEMO_LAYOUT.feedSound,
  };
}

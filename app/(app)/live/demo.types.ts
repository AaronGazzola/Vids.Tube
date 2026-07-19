import type { Counts } from "@/lib/goals";

export type DemoBoxKey =
  | "goalSubs"
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
export const DEMO_LAYOUT_VERSION = 2;

export type DemoLayoutConfig = {
  version: number;
  boxes: Record<DemoBoxKey, DemoBox>;
  visible: Record<DemoOverlayKey, boolean>;
  goalProgressFull: boolean;
  background: DemoBackground;
  mobileChrome: boolean;
};

export const DEMO_OVERLAY_KEYS: DemoOverlayKey[] = [
  "goalSubs",
  "goalLikes",
  "goalViewers",
  "competition",
  "highlight",
  "tts",
  "ask",
  "break",
];

export const DEMO_OVERLAY_LABELS: Record<DemoOverlayKey, string> = {
  goalSubs: "Subs goal",
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
    goalSubs: { x: 48, y: 64, scale: 2 },
    goalLikes: { x: 48, y: 380, scale: 2 },
    goalViewers: { x: 700, y: 64, scale: 2 },
    competition: { x: 48, y: 720, scale: 2 },
    highlight: { x: 120, y: 1260, scale: 2 },
    break: { x: 220, y: 860, scale: 2 },
  },
  visible: {
    goalSubs: true,
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
};

// The counts the demo drives its goal bars toward. Real saved targets are layered
// over these at render time; these are only the fallback when none are set.
export const DEMO_GOAL_TARGETS: Counts = { subs: 1000, likes: 500, viewers: 100 };

export function mergeDemoLayout(
  partial: Partial<DemoLayoutConfig> | null | undefined
): DemoLayoutConfig {
  if (!partial) return DEFAULT_DEMO_LAYOUT;
  const boxesCurrent = partial.version === DEMO_LAYOUT_VERSION;
  return {
    version: DEMO_LAYOUT_VERSION,
    boxes: boxesCurrent
      ? { ...DEFAULT_DEMO_LAYOUT.boxes, ...(partial.boxes ?? {}) }
      : DEFAULT_DEMO_LAYOUT.boxes,
    visible: { ...DEFAULT_DEMO_LAYOUT.visible, ...(partial.visible ?? {}) },
    goalProgressFull:
      partial.goalProgressFull ?? DEFAULT_DEMO_LAYOUT.goalProgressFull,
    background: partial.background ?? DEFAULT_DEMO_LAYOUT.background,
    mobileChrome: partial.mobileChrome ?? DEFAULT_DEMO_LAYOUT.mobileChrome,
  };
}

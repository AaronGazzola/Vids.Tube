import type { Counts } from "@/lib/goals";

export type DemoBoxKey =
  | "goalSubs"
  | "goalLikes"
  | "goalViewers"
  | "competition"
  | "highlight";
export type DemoOverlayKey = DemoBoxKey | "tts" | "ask";
export type DemoBackground = "slideshow" | "gradient" | "black";

export type DemoBox = { x: number; y: number; scale: number };

export type DemoLayoutConfig = {
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
];

export const DEMO_OVERLAY_LABELS: Record<DemoOverlayKey, string> = {
  goalSubs: "Subs goal",
  goalLikes: "Likes goal",
  goalViewers: "Viewers goal",
  competition: "Competition",
  highlight: "Highlight",
  tts: "TTS card",
  ask: "!ask exchange",
};

export const DEFAULT_DEMO_LAYOUT: DemoLayoutConfig = {
  boxes: {
    goalSubs: { x: 24, y: 24, scale: 1 },
    goalLikes: { x: 24, y: 120, scale: 1 },
    goalViewers: { x: 300, y: 24, scale: 1 },
    competition: { x: 24, y: 220, scale: 1 },
    highlight: { x: 160, y: 40, scale: 1 },
  },
  visible: {
    goalSubs: true,
    goalLikes: true,
    goalViewers: true,
    competition: true,
    highlight: true,
    tts: true,
    ask: true,
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
  return {
    boxes: { ...DEFAULT_DEMO_LAYOUT.boxes, ...(partial.boxes ?? {}) },
    visible: { ...DEFAULT_DEMO_LAYOUT.visible, ...(partial.visible ?? {}) },
    goalProgressFull:
      partial.goalProgressFull ?? DEFAULT_DEMO_LAYOUT.goalProgressFull,
    background: partial.background ?? DEFAULT_DEMO_LAYOUT.background,
    mobileChrome: partial.mobileChrome ?? DEFAULT_DEMO_LAYOUT.mobileChrome,
  };
}

import type {
  FeaturedAuthor,
  GoalMetric,
  MetricProgress,
} from "@/app/layout.types";

export const OVERLAY_CANVAS_W = 1080;
export const OVERLAY_CANVAS_H = 1920;

export const OVERLAY_FEED_WIDTH = 420;
export const OVERLAY_GOAL_HEIGHT = 110;

// The drawn diameter of a goal ring at a given height. Lifted out of GoalBar so
// the stage can work out where a goal actually sits on the canvas without
// measuring the DOM: the increment animation flies to that point, and a stage
// and a bar that disagreed about it would aim at empty space.
export function goalDiameter(height: number = OVERLAY_GOAL_HEIGHT): number {
  return Math.max(48, Math.round(height * 0.2));
}

// Where an increment animation begins: the middle of the broadcast, so it reads
// as belonging to the stream rather than to any one overlay.
export const OVERLAY_CANVAS_CENTRE = {
  x: OVERLAY_CANVAS_W / 2,
  y: OVERLAY_CANVAS_H / 2,
} as const;

// The whole flight: zoom up at the centre, hold there long enough to be read,
// then travel to the goal and shrink away. One duration rather than three, so
// the phases stay in the proportions the keyframes set.
export const OVERLAY_GOAL_FLIGHT_MS = 3200;

// What the streamer says when a number goes up. Editable per metric; these are
// only what a channel starts with.
export const DEFAULT_GOAL_RISE_MESSAGES = {
  subs: "Thanks for subscribing!",
  likes: "Thanks for liking the stream!",
  viewers: "Thanks for watching!",
} as const;
export const OVERLAY_LADDER_SIZE = 52;
// How many avatars the ladder lists. The live route, the demo snapshot and the
// editor preview all cut to the same number, so the layout the owner arranges is
// the one that goes to air.
export const OVERLAY_LADDER_MAX = 16;

// Nominal bounding box of each overlay at scale 1, used to size the OBS
// browser source (multiplied by the saved scale).
export const OVERLAY_BASE_DIMS = {
  highlight: { w: 460, h: 400 },
  goal: { w: 160, h: 160 },
  competition: { w: 120, h: 520 },
  break: { w: 320, h: 150 },
  // Three quarters of the 1080-wide canvas, and short: the members strip shares
  // vertical space with the goals, the ladder and the highlight surface.
  messageBanner: { w: 810, h: 128 },
  // A landscape viewport for the game, which is a 3D scene rather than a card:
  // wide enough for a creature that travels, short enough to leave the canvas to
  // the surfaces that carry stream data.
  game: { w: 480, h: 320 },
} as const;

// Base alpha of each surface's black backing, before the owner's opacity slider
// multiplies it. One source of truth so the layout editor's ghost fills to the
// same darkness the real element does: when the ghost guessed, the slider looked
// broken because the preview disagreed with OBS. Anything absent takes the 0.7
// default in the `overlay-surface` utility.
export const OVERLAY_SURFACE_ALPHA = {
  // The members strip is read at a glance over live video, so its slider maps
  // straight to the backing: 100 is solid black, 0 is gone.
  messageBanner: 1,
  goal: 0.4,
} as const;

// The sentence the strip carried before it could cycle. A layout saved before
// messages existed falls back to it, which is why the change needs no version
// bump: the fallback is indistinguishable from the old behaviour.
export const DEFAULT_MEMBER_MESSAGE = "Chat to become a member at Vids.Tube!";

// How long each message holds before the strip advances. Now the default rather
// than the rule: a layout carries its own global time, and a message may carry
// one of its own. This is what both fall back to.
export const OVERLAY_MESSAGE_DWELL_MS = 6000;
export const OVERLAY_MESSAGE_TRANSITION_MS = 600;

// The bounds a display time has to sit within to be usable. The floor is above
// the transition length, because a message that begins leaving before it has
// finished arriving never actually reads as text; the ceiling is the point past
// which a "cycle" is indistinguishable from a stuck banner.
export const OVERLAY_MESSAGE_DWELL_MIN_MS = 1500;
export const OVERLAY_MESSAGE_DWELL_MAX_MS = 120_000;

// One row of the strip, tall enough for the member total beside the message.
// Fixed so the strip's height never depends on which message is showing.
export const OVERLAY_MESSAGE_ROW_H = 40;

// The strip never wraps, so a message that does not fit is clipped rather than
// wrapped. 45 is chosen for the full-width case, which every message after the
// first one gets. A first message near the cap runs into the member total
// beside it and loses its last few characters, so the longest lines belong
// anywhere but first.
export const OVERLAY_MESSAGE_MAX_VISIBLE = 45;

export type OverlayBoxKey =
  | "messageBanner"
  | "goalSubs"
  | "goalLikes"
  | "goalViewers"
  | "competition"
  | "highlight"
  | "break"
  | "game";

// `w` and `h` are canvas units, carried only by a box that resizes freely —
// today the game alone, because it is a camera on a simulation rather than a
// card whose pixels can be stretched. A box without them is scaled uniformly
// about its top-left, exactly as every box was before free resizing existed.
export type OverlayBox = {
  x: number;
  y: number;
  scale: number;
  w?: number;
  h?: number;
};

export type DemoOverlayVisibility = {
  highlight: boolean;
  tts: boolean;
  ask: boolean;
  welcome: boolean;
  messageBanner: boolean;
  goalSubs: boolean;
  goalLikes: boolean;
  goalViewers: boolean;
  competition: boolean;
  break: boolean;
  game: boolean;
};

export type DemoOverlayHighlight = {
  id: string;
  author: FeaturedAuthor | null;
  text: string;
  rank: number;
  progress: number;
};

export type DemoOverlayTts = {
  id: string;
  author: FeaturedAuthor | null;
  text: string;
  rank: number;
  progress: number;
};

export type DemoOverlayAsk = {
  id: string;
  author: FeaturedAuthor | null;
  question: string;
  answer: string;
  includeAnswer: boolean;
  rank: number;
  progress: number;
};

export type DemoOverlayCompetitionEntry = {
  key: string;
  author: FeaturedAuthor | null;
  score: number;
};

export type DemoOverlaySnapshot = {
  active: true;
  boxes: Record<OverlayBoxKey, OverlayBox>;
  visible: DemoOverlayVisibility;
  persist: { highlight: boolean; tts: boolean; ask: boolean };
  metrics: Record<GoalMetric, MetricProgress>;
  competition: DemoOverlayCompetitionEntry[];
  highlights: DemoOverlayHighlight[];
  tts: DemoOverlayTts[];
  asks: DemoOverlayAsk[];
  welcomes: DemoOverlayWelcome[];
};

export type DemoOverlayWelcome = {
  id: string;
  kind: "new" | "returning" | "batch";
  authors: FeaturedAuthor[];
};

export type DemoOverlayEventPayload = DemoOverlaySnapshot | { active: false };

export const DEMO_OVERLAY_EVENT = "snapshot";
export const DEMO_OVERLAY_STALE_MS = 8000;
export const DEMO_TTS_SAMPLE_SRC = "/demo/tts-sample.mp3";

export const GOAL_METRIC_BOX: Record<
  GoalMetric,
  "goalSubs" | "goalLikes" | "goalViewers"
> = {
  subs: "goalSubs",
  likes: "goalLikes",
  viewers: "goalViewers",
};

export function demoOverlayChannelName(channelSlug: string): string {
  return `demo-overlay:${channelSlug}`;
}

export const OVERLAY_LAYOUT_EVENT = "layout";

export function overlayLayoutChannelName(channelSlug: string): string {
  return `overlay-layout:${channelSlug}`;
}

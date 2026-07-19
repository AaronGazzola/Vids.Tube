import type {
  FeaturedAuthor,
  GoalMetric,
  MetricProgress,
} from "@/app/layout.types";

export const OVERLAY_CANVAS_W = 1080;
export const OVERLAY_CANVAS_H = 1920;

export const OVERLAY_FEED_WIDTH = 420;
export const OVERLAY_GOAL_HEIGHT = 110;
export const OVERLAY_LADDER_SIZE = 52;

// Nominal bounding box of each overlay at scale 1, used to size the OBS
// browser source (multiplied by the saved scale).
export const OVERLAY_BASE_DIMS = {
  highlight: { w: 460, h: 400 },
  goal: { w: 160, h: 160 },
  competition: { w: 120, h: 520 },
  break: { w: 320, h: 150 },
} as const;

export type OverlayBoxKey =
  | "goalSubs"
  | "goalLikes"
  | "goalViewers"
  | "competition"
  | "highlight"
  | "break";

export type OverlayBox = { x: number; y: number; scale: number };

export type DemoOverlayVisibility = {
  highlight: boolean;
  tts: boolean;
  ask: boolean;
  goalSubs: boolean;
  goalLikes: boolean;
  goalViewers: boolean;
  competition: boolean;
  break: boolean;
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

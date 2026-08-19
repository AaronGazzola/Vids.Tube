import type { GoalMetric } from "@/app/layout.types";
import {
  DEFAULT_GOAL_RISE_MESSAGES,
  DEFAULT_MEMBER_MESSAGE,
  OVERLAY_BASE_DIMS,
  OVERLAY_MESSAGE_DWELL_MS,
} from "@/lib/demo-overlay";
import type { Counts } from "@/lib/goals";

export type DemoBoxKey =
  | "messageBanner"
  | "goalSubs"
  | "goalLikes"
  | "goalViewers"
  | "competition"
  | "highlight"
  | "break"
  | "game";
export type DemoOverlayKey = DemoBoxKey | "tts" | "ask" | "welcome" | "tasks";
export type DemoBackground = "slideshow" | "gradient" | "black";

// `w` and `h` are canvas units and are carried only by a box that resizes
// freely — today that is the game alone. A box without them is scaled uniformly
// about its top-left, exactly as every box was before free resizing existed, so
// a saved layout means what it always meant and needs no version bump.
//
// The game needs them because it is not a card whose pixels can be stretched: it
// is a camera on a simulation, and it reframes on a genuine viewport change.
export type DemoBox = {
  x: number;
  y: number;
  scale: number;
  w?: number;
  h?: number;
};

// Bumped when the meaning of box coordinates changes; saved layouts from an
// older version keep their toggles but fall back to the default boxes.
// v3 added the wide members strip. The subscriber goal box later returned beside
// it without a bump: a box that is new, or that was never saved, takes its
// default, and a v2 layout that still carries goalSubs coordinates means by them
// exactly what it always did.
export const DEMO_LAYOUT_VERSION = 3;

export type OverlayFeedSound = "chime" | "off";

export type StripAlign = "left" | "center";

// One message on the members strip: the text the streamer wrote, markup and
// all, plus where it sits on its line. Alignment is a property of the line
// rather than of a run, so it is stored beside the text rather than inside the
// markup dialect.
// The counts a banner message may show. A kind naming "this stream" is scoped to
// the live broadcast; one that does not is the channel's lifetime figure.
export const BANNER_METRIC_KINDS = [
  "totalSubs",
  "newSubsThisStream",
  "likesThisStream",
  "currentViewers",
  "chattersThisStream",
  "chatsThisStream",
  "commandsThisStream",
  "members",
  "newMembersThisStream",
] as const;
export type BannerMetricKind = (typeof BANNER_METRIC_KINDS)[number];

export const BANNER_METRIC_LABELS: Record<BannerMetricKind, string> = {
  totalSubs: "Total subs",
  newSubsThisStream: "New subs this stream",
  likesThisStream: "Likes this stream",
  currentViewers: "Current viewers",
  chattersThisStream: "Unique chatters this stream",
  chatsThisStream: "Chats this stream",
  commandsThisStream: "Chat commands this stream",
  members: "Members",
  newMembersThisStream: "New members this stream",
};

// Stored as a name rather than as a drawing, so the set can change later without
// another migration over every saved layout.
export const BANNER_ICON_NAMES = [
  "logo",
  "subs",
  "likes",
  "viewers",
  "heart",
  "star",
  "flame",
  "trophy",
  "bell",
  "thumbsUp",
  "users",
  "eye",
] as const;
export type BannerIconName = (typeof BANNER_ICON_NAMES)[number];

export type StripMetric = {
  kind: BannerMetricKind;
  icon: BannerIconName;
  color: string;
};

// One message on the banner: the text the streamer wrote, markup and all, where
// it sits on its line, and at most one number to show beside it. Alignment is a
// property of the line rather than of a run, so it is stored beside the text
// rather than inside the markup dialect.
// `dwellMs` absent means "follow the banner's global time", and that is a
// different thing from a time that happens to equal the global one: changing the
// global moves the first and leaves the second where the streamer put it. Absent
// is therefore stored as absent, never written out as the global's number.
export type StripMessage = {
  text: string;
  align: StripAlign;
  metric?: StripMetric;
  dwellMs?: number;
};

export type DemoLayoutConfig = {
  version: number;
  boxes: Record<DemoBoxKey, DemoBox>;
  visible: Record<DemoOverlayKey, boolean>;
  goalProgressFull: boolean;
  background: DemoBackground;
  mobileChrome: boolean;
  boxOpacity: Record<DemoBoxKey, number>;
  feedSound: OverlayFeedSound;
  // The messages the strip cycles through. They ride the layout push that
  // already carries a box move, so a saved message reaches OBS on the same
  // path. Edits are held as a draft in the store until Save changes, so a
  // half-typed sentence never reaches a broadcast.
  messages: StripMessage[];
  // How long a message holds when it carries no time of its own, and whether the
  // banner draws its frame. Required here rather than optional because the
  // layout loader fills both from the defaults; a layout saved before either
  // existed therefore means today's behaviour without a version bump.
  bannerDwellMs: number;
  bannerBorder: boolean;
  // Per goal overlay: whether a rise is announced across the broadcast, and what
  // the announcement says. Both keyed by metric rather than by box, because it
  // is the meaning of the number that decides the wording.
  goalAnimate: Record<GoalMetric, boolean>;
  goalRiseMessages: Record<GoalMetric, string>;
};

export const DEMO_OVERLAY_KEYS: DemoOverlayKey[] = [
  "messageBanner",
  "goalSubs",
  "goalLikes",
  "goalViewers",
  "competition",
  "highlight",
  "tts",
  "ask",
  "welcome",
  "break",
  "game",
];

export const DEMO_OVERLAY_LABELS: Record<DemoOverlayKey, string> = {
  messageBanner: "Message banner",
  goalSubs: "Subs goal",
  goalLikes: "Likes goal",
  goalViewers: "Viewers goal",
  competition: "Competition",
  highlight: "Highlight",
  tts: "TTS card",
  ask: "!ask exchange",
  welcome: "Welcome card",
  tasks: "Task list",
  break: "Break timer",
  game: "Game",
};

// Box coordinates live on the 1080x1920 vertical stream canvas, so a saved
// layout renders identically in the preview and in a full-canvas OBS source.
export const DEFAULT_DEMO_LAYOUT: DemoLayoutConfig = {
  version: DEMO_LAYOUT_VERSION,
  boxes: {
    // Centred across the top at scale 1: 810 wide on a 1080 canvas leaves 135
    // either side, so the strip reads as a banner rather than a floating box.
    messageBanner: { x: 135, y: 56, scale: 1 },
    // Mirrors the likes goal across the canvas, below the viewers goal: the two
    // columns the strip leaves free once it takes the top band.
    goalSubs: { x: 700, y: 380, scale: 2 },
    goalLikes: { x: 48, y: 380, scale: 2 },
    goalViewers: { x: 700, y: 64, scale: 2 },
    competition: { x: 48, y: 720, scale: 2 },
    highlight: { x: 120, y: 1260, scale: 2 },
    break: { x: 220, y: 860, scale: 2 },
    // Right of the ladder and below the viewers goal, at scale 1: the band of
    // the canvas no other surface claims by default.
    // The only box carrying its own width and height, because it is the only one
    // that resizes freely. The numbers are the size the game has always been
    // framed at, so an overlay nobody resizes looks exactly as it did.
    game: { x: 480, y: 600, scale: 1, w: 480, h: 320 },
  },
  visible: {
    messageBanner: true,
    goalSubs: true,
    goalLikes: true,
    goalViewers: true,
    competition: true,
    highlight: true,
    tts: true,
    ask: true,
    welcome: true,
    tasks: true,
    break: false,
    // Off by default: an existing channel's overlay must not gain a window on
    // deploy, and the window shows nothing at all unless a game is configured.
    game: false,
  },
  goalProgressFull: false,
  background: "slideshow",
  mobileChrome: false,
  boxOpacity: {
    messageBanner: 1,
    goalSubs: 1,
    goalLikes: 1,
    goalViewers: 1,
    competition: 0.6,
    highlight: 1,
    break: 1,
    game: 1,
  },
  feedSound: "chime",
  // The default carries the member count, which is what the banner drew before
  // metrics existed and what the migration gave every saved layout. A fresh
  // channel must not be the only one starting without a number.
  messages: [
    {
      text: DEFAULT_MEMBER_MESSAGE,
      align: "left",
      metric: { kind: "members", icon: "logo", color: "#ffffff" },
    },
  ],
  bannerDwellMs: OVERLAY_MESSAGE_DWELL_MS,
  bannerBorder: true,
  goalAnimate: { subs: true, likes: true, viewers: true },
  goalRiseMessages: { ...DEFAULT_GOAL_RISE_MESSAGES },
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
  "messageBanner",
  "goalSubs",
  "goalLikes",
  "goalViewers",
  "competition",
  "highlight",
  "break",
  "game",
];

// A version bump used to throw away every saved position, which cost the owner
// their whole layout every time an overlay changed. Positions are hard-won and
// are never discarded wholesale again.
//
// A version lists only the boxes whose coordinates genuinely changed meaning at
// that version; every other box carries its saved position forward. A box that
// is new, or that was never saved, takes its default.
const RESET_AT_VERSION: Record<number, DemoBoxKey[]> = {
  // v3 introduced the members strip. Nothing that already existed moved, so
  // nothing is reset.
  3: [],
};

function isBox(value: unknown): value is DemoBox {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Partial<DemoBox>;
  if (
    !Number.isFinite(b.x) ||
    !Number.isFinite(b.y) ||
    !Number.isFinite(b.scale)
  ) {
    return false;
  }
  // Absent is valid and means "scaled uniformly". Present but unreadable is not:
  // a saved width of NaN would size a frame to nothing on a live stream.
  const sized = (n: unknown) =>
    n === undefined || (Number.isFinite(n) && (n as number) > 0);
  return sized(b.w) && sized(b.h);
}

// An absent, unreadable or empty message list becomes the sentence the strip
// carried before it could cycle, so a layout saved before this change renders
// exactly as it did and no version bump is needed. A bare string is read as a
// left-aligned message, which is what a message was before alignment existed.
// A metric naming a kind or an icon this build does not know is dropped rather
// than taking its message down with it: the words still reach the broadcast.
function readMetric(value: unknown): StripMetric | null {
  if (typeof value !== "object" || value === null) return null;
  const m = value as Partial<StripMetric>;
  const kind = BANNER_METRIC_KINDS.find((k) => k === m.kind);
  if (!kind) return null;
  const icon = BANNER_ICON_NAMES.find((i) => i === m.icon) ?? "logo";
  const color =
    typeof m.color === "string" && /^#[0-9a-fA-F]{6}$/.test(m.color)
      ? m.color.toLowerCase()
      : "#ffffff";
  return { kind, icon, color };
}

function readMessage(value: unknown): StripMessage | null {
  if (typeof value === "string") {
    return value.trim() ? { text: value, align: "left" } : null;
  }
  if (typeof value !== "object" || value === null) return null;
  const m = value as Partial<StripMessage>;
  if (typeof m.text !== "string" || !m.text.trim()) return null;
  const metric = readMetric(m.metric);
  // Spread only when present. Writing `dwellMs: undefined` would still create
  // the key, and "carries no time of its own" has to survive a save-and-reload
  // as an absent key rather than as a present undefined one.
  const dwell = typeof m.dwellMs === "number" ? m.dwellMs : null;
  return {
    text: m.text,
    align: m.align === "center" ? "center" : "left",
    ...(metric ? { metric } : {}),
    ...(dwell !== null ? { dwellMs: dwell } : {}),
  };
}

function readMessages(value: unknown): StripMessage[] {
  if (!Array.isArray(value)) return DEFAULT_DEMO_LAYOUT.messages;
  const messages = value
    .map(readMessage)
    .filter((m): m is StripMessage => m !== null);
  return messages.length ? messages : DEFAULT_DEMO_LAYOUT.messages;
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
  // A game box saved before it could be resized freely carries a scale and no
  // size. Its scale is turned into a width and a height covering exactly the
  // area it already occupied, so it looks identical and gains the free handles
  // straight away rather than only after somebody drags it once. No version bump:
  // the saved coordinates are not being reinterpreted, only expressed the way
  // this box now expresses them.
  if (boxes.game.w === undefined || boxes.game.h === undefined) {
    boxes.game = {
      ...boxes.game,
      w: OVERLAY_BASE_DIMS.game.w * boxes.game.scale,
      h: OVERLAY_BASE_DIMS.game.h * boxes.game.scale,
      scale: 1,
    };
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
    messages: readMessages(partial.messages),
    // A layout saved before either setting existed carries neither, and takes
    // today's behaviour: the six-second default and a drawn border.
    bannerDwellMs: partial.bannerDwellMs ?? DEFAULT_DEMO_LAYOUT.bannerDwellMs,
    bannerBorder: partial.bannerBorder ?? DEFAULT_DEMO_LAYOUT.bannerBorder,
    goalAnimate: {
      ...DEFAULT_DEMO_LAYOUT.goalAnimate,
      ...(partial.goalAnimate ?? {}),
    },
    goalRiseMessages: {
      ...DEFAULT_DEMO_LAYOUT.goalRiseMessages,
      ...(partial.goalRiseMessages ?? {}),
    },
  };
}

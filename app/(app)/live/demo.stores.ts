"use client";

import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { create } from "zustand";
import {
  DEFAULT_DEMO_LAYOUT,
  mergeDemoLayout,
  type DemoBackground,
  type DemoBox,
  type DemoBoxKey,
  type DemoLayoutConfig,
  type DemoOverlayKey,
} from "./demo.types";

// ── Layout store ───────────────────────────────────────────────────────────

export type DemoPersistKey = "highlight" | "tts" | "ask";

type LayoutState = {
  config: DemoLayoutConfig;
  hydrated: boolean;
  // Whether the on-stage controls panel is shown (ephemeral UI state, not saved).
  panelOpen: boolean;
  // Per-overlay "keep on screen" flags (ephemeral, not saved).
  persist: Record<DemoPersistKey, boolean>;
  setPersist: (key: DemoPersistKey, v: boolean) => void;
  setPanelOpen: (v: boolean) => void;
  hydrate: (c: DemoLayoutConfig) => void;
  setBox: (key: DemoBoxKey, box: DemoBox) => void;
  toggleVisible: (key: DemoOverlayKey) => void;
  setGoalProgressFull: (v: boolean) => void;
  setBackground: (bg: DemoBackground) => void;
  setMobileChrome: (v: boolean) => void;
  resetLayout: () => void;
};

export const useDemoLayoutStore = create<LayoutState>((set) => ({
  config: DEFAULT_DEMO_LAYOUT,
  hydrated: false,
  panelOpen: true,
  persist: { highlight: false, tts: false, ask: false },
  setPersist: (key, v) =>
    set((s) => ({ persist: { ...s.persist, [key]: v } })),
  setPanelOpen: (v) => set({ panelOpen: v }),
  hydrate: (c) => set({ config: mergeDemoLayout(c), hydrated: true }),
  setBox: (key, box) =>
    set((s) => ({
      config: { ...s.config, boxes: { ...s.config.boxes, [key]: box } },
    })),
  toggleVisible: (key) =>
    set((s) => ({
      config: {
        ...s.config,
        visible: { ...s.config.visible, [key]: !s.config.visible[key] },
      },
    })),
  setGoalProgressFull: (v) =>
    set((s) => ({ config: { ...s.config, goalProgressFull: v } })),
  setBackground: (bg) =>
    set((s) => ({ config: { ...s.config, background: bg } })),
  setMobileChrome: (v) =>
    set((s) => ({ config: { ...s.config, mobileChrome: v } })),
  resetLayout: () =>
    set((s) => ({
      config: { ...s.config, boxes: DEFAULT_DEMO_LAYOUT.boxes },
    })),
}));

// ── Generator store ────────────────────────────────────────────────────────

export type DemoOrigin = "vidstube" | "youtube";

export type DemoViewer = {
  key: string;
  origin: DemoOrigin;
  name: string;
  handle: string | null;
  avatarUrl: string;
};

export type DemoMessage = {
  id: string;
  viewerKey: string;
  text: string;
  bot: boolean;
  hidden: boolean;
  hiddenBy: "owner" | "ai" | null;
  featured: boolean;
  promoted: boolean;
  dismissed: boolean;
  score: number | null;
  reason: string | null;
};

export type DemoTtsRequest = {
  id: string;
  viewerKey: string;
  text: string;
  status: "suggested" | "approved" | "dismissed" | "played";
};

export type DemoAskRequest = {
  id: string;
  viewerKey: string;
  question: string;
  answer: string;
  includeAnswer: boolean;
  status: "suggested" | "approved" | "dismissed" | "shown";
};

export type DemoClipMarker = {
  id: string;
  viewerKey: string;
  note: string;
  at: string;
};

export type DemoModAction = {
  id: string;
  action: "hide" | "ban";
  viewerKey: string;
  body: string;
  reason: string;
  status: "suggested" | "applied";
};

export type DemoScore = { total: number; features: number };

const NAMES: [string, string | null, DemoOrigin][] = [
  ["Ava Chen", "avachen", "vidstube"],
  ["Marcus", "mrcs", "vidstube"],
  ["pixelwitch", "pixelwitch", "vidstube"],
  ["Delia R.", "deliar", "vidstube"],
  ["StreamFan92", null, "youtube"],
  ["QuietRiot", null, "youtube"],
  ["nova_", "nova", "vidstube"],
  ["Ben T", null, "youtube"],
  ["hollowtones", "hollowtones", "vidstube"],
  ["GG_Kai", null, "youtube"],
  ["Suki", "suki", "vidstube"],
  ["torchlight", "torchlight", "vidstube"],
  ["Mena P.", "menap", "vidstube"],
  ["JDub", null, "youtube"],
  ["frostbyte", null, "youtube"],
  ["Liv", "livstreams", "vidstube"],
  ["okra_boy", null, "youtube"],
  ["Cassidy", "cassidy", "vidstube"],
  ["moth.exe", null, "youtube"],
  ["Ravi K", "ravik", "vidstube"],
  ["sleepytea", "sleepytea", "vidstube"],
  ["BigLantern", null, "youtube"],
  ["june bug", null, "youtube"],
  ["Petra", "petra", "vidstube"],
  ["wanderfall", "wanderfall", "vidstube"],
  ["ZipZap", null, "youtube"],
];

const CHAT_LINES = [
  "let's gooo 🔥",
  "this part is so good",
  "how did you set up that overlay?",
  "first time catching you live!",
  "the goals bar looks clean",
  "wait rewind that",
  "🤣🤣 that reaction",
  "poggers",
  "what mic are you using?",
  "greetings from Berlin 👋",
  "the competition is heating up",
  "who's winning rn",
  "that transition was smooth",
  "chat is moving fast today",
  "can you do a giveaway?",
];

const FEATURE_LINES = [
  "honestly this is the best explanation of that I've ever heard, thank you",
  "been following since 200 subs, so proud of this channel 🎉",
  "your editing on the last VOD carried me through a rough week",
  "the community here is genuinely the friendliest on the platform",
];

const TOXIC_LINES = [
  "this stream is garbage lol",
  "spam spam buy followers cheap link",
  "you're so bad at this",
];

const FEATURE_REASONS = [
  "Warm, high-signal message that lifts the room",
  "Genuine long-time-supporter moment",
  "Specific, constructive praise worth surfacing",
];

const TTS_LINES = [
  "big shoutout to the mods, you keep this place cozy",
  "GG on hitting the goal, that grind was real",
  "hello from the night shift crew, keep it up",
];

const ASK_QAS: { q: string; a: string }[] = [
  {
    q: "what editor theme is that?",
    a: "It's the default dark theme in VS Code with the Fira Code font.",
  },
  {
    q: "how long have you been building vids.tube?",
    a: "About eight months — it started as a weekend project and kept growing.",
  },
  {
    q: "will the overlays be open source?",
    a: "That's the plan once v1 stabilizes — watch the repo for updates.",
  },
];

const CLIP_NOTES = [
  "that overlay reveal",
  "chat exploding at the goal",
  "the live bug fix",
];

function clipTime(seq: number): string {
  const minutes = 10 + (seq % 50);
  const seconds = (seq * 17) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function botMessage(id: string, text: string): DemoMessage {
  return {
    id,
    viewerKey: "",
    text,
    bot: true,
    hidden: false,
    hiddenBy: null,
    featured: false,
    promoted: false,
    dismissed: false,
    score: null,
    reason: null,
  };
}

function viewerMessage(
  id: string,
  viewerKey: string,
  text: string
): DemoMessage {
  return {
    id,
    viewerKey,
    text,
    bot: false,
    hidden: false,
    hiddenBy: null,
    featured: false,
    promoted: false,
    dismissed: false,
    score: null,
    reason: null,
  };
}

function viewerFrom([name, handle, origin]: [
  string,
  string | null,
  DemoOrigin,
]): DemoViewer {
  const key = origin === "vidstube" ? `demo:${handle ?? name}` : `youtube:${name}`;
  return {
    key,
    origin,
    name,
    handle,
    avatarUrl: placeholderAvatar(handle ?? name),
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type GeneratorState = {
  seq: number;
  viewers: DemoViewer[];
  messages: DemoMessage[];
  scores: Record<string, DemoScore>;
  mod: DemoModAction[];
  banned: Set<string>;
  counts: { subs: number; likes: number; viewers: number };
  tts: DemoTtsRequest[];
  asks: DemoAskRequest[];
  clips: DemoClipMarker[];
  wrapupDone: boolean;
  seed: () => void;
  tick: () => void;
  hideMessage: (id: string) => void;
  unhideMessage: (id: string) => void;
  highlightMessage: (id: string) => void;
  dismissMessage: (id: string) => void;
  banViewer: (viewerKey: string, hidePast: boolean) => void;
  unbanViewer: (viewerKey: string) => void;
  approveMod: (id: string) => void;
  dismissMod: (id: string) => void;
  playHighlight: () => void;
  playTts: () => void;
  playAsk: () => void;
  approveTts: (id: string) => void;
  dismissTts: (id: string) => void;
  markTtsPlayed: (id: string) => void;
  approveAsk: (id: string, includeAnswer: boolean) => void;
  dismissAsk: (id: string) => void;
  markAskShown: (id: string) => void;
  runWrapup: () => void;
};

const MAX_MESSAGES = 120;

function seededInteractivity() {
  const viewers = NAMES.map(viewerFrom);
  const ttsViewer = viewers[0];
  const askViewer1 = viewers[4];
  const askViewer2 = viewers[10];
  const clipViewer = viewers[7];
  const tts: DemoTtsRequest[] = [
    {
      id: "tts-seed-1",
      viewerKey: ttsViewer.key,
      text: TTS_LINES[0],
      status: "suggested" as const,
    },
  ];
  const asks: DemoAskRequest[] = [
    {
      id: "ask-seed-1",
      viewerKey: askViewer1.key,
      question: ASK_QAS[0].q,
      answer: ASK_QAS[0].a,
      includeAnswer: true,
      status: "suggested" as const,
    },
    {
      id: "ask-seed-2",
      viewerKey: askViewer2.key,
      question: ASK_QAS[1].q,
      answer: ASK_QAS[1].a,
      includeAnswer: true,
      status: "suggested" as const,
    },
  ];
  const clips: DemoClipMarker[] = [
    {
      id: "clip-seed-1",
      viewerKey: clipViewer.key,
      note: CLIP_NOTES[0],
      at: clipTime(7),
    },
  ];
  const messages: DemoMessage[] = [
    viewerMessage("dm-seed-tts", ttsViewer.key, `!tts ${TTS_LINES[0]}`),
    botMessage(
      "dm-seed-tts-ack",
      `${ttsViewer.name}, your TTS request is awaiting approval.`
    ),
    viewerMessage("dm-seed-ask-1", askViewer1.key, `!ask ${ASK_QAS[0].q}`),
    botMessage(
      "dm-seed-ask-1-ack",
      `${askViewer1.name}, your question is queued for the streamer.`
    ),
    viewerMessage("dm-seed-ask-2", askViewer2.key, `!ask ${ASK_QAS[1].q}`),
    botMessage(
      "dm-seed-ask-2-ack",
      `${askViewer2.name}, your question is queued for the streamer.`
    ),
    viewerMessage("dm-seed-clip", clipViewer.key, `!clip ${CLIP_NOTES[0]}`),
    botMessage(
      "dm-seed-clip-ack",
      `Clip marked at ${clipTime(7)} — "${CLIP_NOTES[0]}". It may become a YouTube short!`
    ),
  ];
  return { viewers, tts, asks, clips, messages };
}

function seededState() {
  const { viewers, tts, asks, clips, messages } = seededInteractivity();
  return {
    seq: 0,
    viewers,
    messages,
    scores: {},
    mod: [],
    banned: new Set<string>(),
    counts: { subs: 40, likes: 60, viewers: 12 },
    tts,
    asks,
    clips,
    wrapupDone: false,
  };
}

export const useDemoGeneratorStore = create<GeneratorState>((set) => ({
  ...seededState(),
  seed: () => set(() => seededState()),
  tick: () =>
    set((s) => {
      const seq = s.seq + 1;
      const eligible = s.viewers.filter((v) => !s.banned.has(v.key));
      if (!eligible.length) return { seq };
      const viewer = pick(eligible);
      const roll = Math.random();

      const id = `dm-${seq}`;
      let msg: DemoMessage;
      const scores = { ...s.scores };
      const mod = s.mod;
      let nextMod = mod;

      if (roll < 0.16) {
        const extras: Partial<GeneratorState> = {};
        let rows: DemoMessage[];
        if (roll < 0.06) {
          const text = pick(TTS_LINES);
          extras.tts = [
            ...s.tts,
            { id: `tts-${seq}`, viewerKey: viewer.key, text, status: "suggested" as const },
          ].slice(-20);
          rows = [
            viewerMessage(id, viewer.key, `!tts ${text}`),
            botMessage(
              `${id}-ack`,
              `${viewer.name}, your TTS request is awaiting approval.`
            ),
          ];
        } else if (roll < 0.12) {
          const qa = pick(ASK_QAS);
          extras.asks = [
            ...s.asks,
            {
              id: `ask-${seq}`,
              viewerKey: viewer.key,
              question: qa.q,
              answer: qa.a,
              includeAnswer: true,
              status: "suggested" as const,
            },
          ].slice(-20);
          rows = [
            viewerMessage(id, viewer.key, `!ask ${qa.q}`),
            botMessage(
              `${id}-ack`,
              `${viewer.name}, your question is queued for the streamer.`
            ),
          ];
        } else {
          const note = pick(CLIP_NOTES);
          const at = clipTime(seq);
          extras.clips = [
            ...s.clips,
            { id: `clip-${seq}`, viewerKey: viewer.key, note, at },
          ].slice(-20);
          rows = [
            viewerMessage(id, viewer.key, `!clip ${note}`),
            botMessage(
              `${id}-ack`,
              `Clip marked at ${at} — "${note}". It may become a YouTube short!`
            ),
          ];
        }
        return {
          seq,
          messages: [...s.messages, ...rows].slice(-MAX_MESSAGES),
          ...extras,
        };
      }

      if (roll < 0.26) {
        // Toxic → the bot flags it. Hide is auto-applied; a ban is suggested.
        const text = pick(TOXIC_LINES);
        const ban = Math.random() < 0.4;
        msg = {
          id,
          viewerKey: viewer.key,
          text,
          bot: false,
          hidden: true,
          hiddenBy: "ai",
          featured: false,
          promoted: false,
          dismissed: false,
          score: null,
          reason: null,
        };
        const entry: DemoModAction = {
          id: `ma-${seq}`,
          action: ban ? "ban" : "hide",
          viewerKey: viewer.key,
          body: text,
          reason: ban
            ? "Repeated spam / link posting"
            : "Toxic language auto-hidden",
          status: ban ? "suggested" : "applied",
        };
        nextMod = [entry, ...mod].slice(0, 40);
      } else if (roll < 0.4) {
        // Standout → featured (bot-suggested highlight) + a score bump.
        const text = pick(FEATURE_LINES);
        const score = 6 + Math.floor(Math.random() * 4);
        const prev = scores[viewer.key] ?? { total: 0, features: 0 };
        scores[viewer.key] = {
          total: prev.total + score,
          features: prev.features + 1,
        };
        msg = {
          id,
          viewerKey: viewer.key,
          text,
          bot: false,
          hidden: false,
          hiddenBy: null,
          featured: true,
          promoted: false,
          dismissed: false,
          score,
          reason: pick(FEATURE_REASONS),
        };
      } else {
        // Normal chatter → small score.
        const text = pick(CHAT_LINES);
        const score = 1 + Math.floor(Math.random() * 3);
        const prev = scores[viewer.key] ?? { total: 0, features: 0 };
        scores[viewer.key] = {
          total: prev.total + score,
          features: prev.features,
        };
        msg = {
          id,
          viewerKey: viewer.key,
          text,
          bot: false,
          hidden: false,
          hiddenBy: null,
          featured: false,
          promoted: false,
          dismissed: false,
          score: null,
          reason: null,
        };
      }

      if (Math.random() < 0.22) {
        const ranked = Object.entries(scores)
          .filter(([key]) => !s.banned.has(key))
          .sort((a, b) => b[1].total - a[1].total);
        if (ranked.length >= 2) {
          const idx = 1 + Math.floor(Math.random() * Math.min(3, ranked.length - 1));
          const [key, sc] = ranked[idx];
          const above = ranked[idx - 1][1].total;
          scores[key] = {
            ...sc,
            total: above + 1 + Math.floor(Math.random() * 3),
          };
        }
      }

      const messages = [...s.messages, msg].slice(-MAX_MESSAGES);
      const counts = {
        subs: s.counts.subs + (Math.random() < 0.3 ? 1 : 0),
        likes: s.counts.likes + (Math.random() < 0.6 ? 1 : 0),
        viewers: Math.max(
          1,
          s.counts.viewers + (Math.random() < 0.5 ? 1 : -1)
        ),
      };
      return { seq, messages, scores, mod: nextMod, counts };
    }),
  hideMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, hidden: true, hiddenBy: "owner" } : m
      ),
    })),
  unhideMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, hidden: false, hiddenBy: null } : m
      ),
    })),
  highlightMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? { ...m, featured: true, promoted: true, dismissed: false }
          : m
      ),
    })),
  dismissMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, dismissed: true } : m
      ),
    })),
  banViewer: (viewerKey, hidePast) =>
    set((s) => {
      const banned = new Set(s.banned);
      banned.add(viewerKey);
      const messages = hidePast
        ? s.messages.map((m) =>
            m.viewerKey === viewerKey && !m.hidden
              ? { ...m, hidden: true, hiddenBy: "owner" as const }
              : m
          )
        : s.messages;
      const viewer = s.viewers.find((v) => v.key === viewerKey);
      const entry: DemoModAction = {
        id: `ma-owner-${s.seq}-${viewerKey}`,
        action: "ban",
        viewerKey,
        body: viewer?.name ?? "viewer",
        reason: "Banned by owner",
        status: "applied",
      };
      const mod: DemoModAction[] = [entry, ...s.mod].slice(0, 40);
      return { banned, messages, mod };
    }),
  unbanViewer: (viewerKey) =>
    set((s) => {
      const banned = new Set(s.banned);
      banned.delete(viewerKey);
      return {
        banned,
        mod: s.mod.filter(
          (a) => !(a.action === "ban" && a.viewerKey === viewerKey)
        ),
      };
    }),
  approveMod: (id) =>
    set((s) => ({
      mod: s.mod.map((a) => (a.id === id ? { ...a, status: "applied" } : a)),
      banned: (() => {
        const a = s.mod.find((x) => x.id === id);
        if (a?.action === "ban") {
          const banned = new Set(s.banned);
          banned.add(a.viewerKey);
          return banned;
        }
        return s.banned;
      })(),
    })),
  dismissMod: (id) =>
    set((s) => ({ mod: s.mod.filter((a) => a.id !== id) })),
  playHighlight: () =>
    set((s) => {
      const seq = s.seq + 1;
      const eligible = s.viewers.filter((v) => !s.banned.has(v.key));
      if (!eligible.length) return { seq };
      const viewer = pick(eligible);
      const score = 6 + Math.floor(Math.random() * 4);
      const prev = s.scores[viewer.key] ?? { total: 0, features: 0 };
      const msg: DemoMessage = {
        ...viewerMessage(`dm-play-${seq}`, viewer.key, pick(FEATURE_LINES)),
        featured: true,
        promoted: true,
        score,
        reason: pick(FEATURE_REASONS),
      };
      return {
        seq,
        scores: {
          ...s.scores,
          [viewer.key]: {
            total: prev.total + score,
            features: prev.features + 1,
          },
        },
        messages: [...s.messages, msg].slice(-MAX_MESSAGES),
      };
    }),
  playTts: () =>
    set((s) => {
      const seq = s.seq + 1;
      const viewer = pick(s.viewers);
      return {
        seq,
        tts: [
          ...s.tts,
          {
            id: `tts-play-${seq}`,
            viewerKey: viewer.key,
            text: pick(TTS_LINES),
            status: "approved" as const,
          },
        ].slice(-20),
      };
    }),
  playAsk: () =>
    set((s) => {
      const seq = s.seq + 1;
      const viewer = pick(s.viewers);
      const qa = pick(ASK_QAS);
      return {
        seq,
        asks: [
          ...s.asks,
          {
            id: `ask-play-${seq}`,
            viewerKey: viewer.key,
            question: qa.q,
            answer: qa.a,
            includeAnswer: true,
            status: "approved" as const,
          },
        ].slice(-20),
      };
    }),
  approveTts: (id) =>
    set((s) => ({
      tts: s.tts.map((t) => (t.id === id ? { ...t, status: "approved" } : t)),
    })),
  dismissTts: (id) =>
    set((s) => ({
      tts: s.tts.map((t) => (t.id === id ? { ...t, status: "dismissed" } : t)),
    })),
  markTtsPlayed: (id) =>
    set((s) => ({
      tts: s.tts.map((t) => (t.id === id ? { ...t, status: "played" } : t)),
    })),
  approveAsk: (id, includeAnswer) =>
    set((s) => ({
      asks: s.asks.map((a) =>
        a.id === id ? { ...a, includeAnswer, status: "approved" } : a
      ),
    })),
  dismissAsk: (id) =>
    set((s) => ({
      asks: s.asks.map((a) =>
        a.id === id ? { ...a, status: "dismissed" } : a
      ),
    })),
  markAskShown: (id) =>
    set((s) => ({
      asks: s.asks.map((a) => (a.id === id ? { ...a, status: "shown" } : a)),
    })),
  runWrapup: () =>
    set((s) => {
      if (s.wrapupDone) return s;
      const ranked = s.viewers
        .map((v) => ({ v, total: s.scores[v.key]?.total ?? 0 }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total);
      const mvp = ranked[0] ?? null;
      const rows: DemoMessage[] = [
        botMessage(
          `dm-wrapup-mvp-${s.seq}`,
          mvp
            ? `MVP of the stream: ${mvp.v.name} with ${mvp.total} points — thanks for carrying the chat!`
            : "MVP of the stream: the whole chat — thanks for hanging out!"
        ),
        botMessage(
          `dm-wrapup-summary-${s.seq}`,
          "Tonight we shipped the new overlay stack, squashed a live bug on stream, and pushed the goal bar within reach. See you next time!"
        ),
        botMessage(
          `dm-wrapup-thanks-${s.seq}`,
          "Thanks for watching! Check out what we're building at vids.tube — and drop a follow so you catch the next one."
        ),
      ];
      return {
        wrapupDone: true,
        messages: [...s.messages, ...rows].slice(-MAX_MESSAGES),
      };
    }),
}));

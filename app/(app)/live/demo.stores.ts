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

type LayoutState = {
  config: DemoLayoutConfig;
  hydrated: boolean;
  // Whether the on-stage controls panel is shown (ephemeral UI state, not saved).
  panelOpen: boolean;
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
  hidden: boolean;
  hiddenBy: "owner" | "ai" | null;
  featured: boolean;
  promoted: boolean;
  dismissed: boolean;
  score: number | null;
  reason: string | null;
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
};

const MAX_MESSAGES = 120;

export const useDemoGeneratorStore = create<GeneratorState>((set) => ({
  seq: 0,
  viewers: NAMES.map(viewerFrom),
  messages: [],
  scores: {},
  mod: [],
  banned: new Set(),
  counts: { subs: 40, likes: 60, viewers: 12 },
  seed: () =>
    set(() => ({
      seq: 0,
      viewers: NAMES.map(viewerFrom),
      messages: [],
      scores: {},
      mod: [],
      banned: new Set(),
      counts: { subs: 40, likes: 60, viewers: 12 },
    })),
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

      if (roll < 0.12) {
        // Toxic → the bot flags it. Hide is auto-applied; a ban is suggested.
        const text = pick(TOXIC_LINES);
        const ban = Math.random() < 0.4;
        msg = {
          id,
          viewerKey: viewer.key,
          text,
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
      } else if (roll < 0.28) {
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
          hidden: false,
          hiddenBy: null,
          featured: false,
          promoted: false,
          dismissed: false,
          score: null,
          reason: null,
        };
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
}));

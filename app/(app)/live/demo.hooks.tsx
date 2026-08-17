"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import {
  DEMO_OVERLAY_EVENT,
  demoOverlayChannelName,
  OVERLAY_LADDER_MAX,
  OVERLAY_LAYOUT_EVENT,
  overlayLayoutChannelName,
  type DemoOverlaySnapshot,
} from "@/lib/demo-overlay";
import { computeGoalProgress, reachedProgress, type Counts } from "@/lib/goals";
import { computeStandings } from "@/lib/standings";
import { supabase } from "@/supabase/browser-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  getDemoFramesAction,
  getDemoLayoutAction,
  getOverlayUrlInfoAction,
  regenerateOverlayTokenAction,
  saveDemoLayoutAction,
} from "./demo.actions";
import { useDemoGeneratorStore, useDemoLayoutStore } from "./demo.stores";
import { DEMO_GOAL_TARGETS, mergeDemoLayout } from "./demo.types";

// Hydrate the layout store from the DB when demo turns on, then debounce-persist
// any changes the owner makes (drag, toggle, background) back to the DB. Saves
// only fire for configs that diverge from the hydrated baseline, so the default
// layout is a display fallback and is never persisted on its own.
// Hydration and the save gate key off the store's own `hydrated` flag, not a
// component ref: Fast Refresh recreates the store (config back to defaults,
// hydrated back to false) while component refs survive, so a ref-based gate
// would persist the defaults. The store flag blocks saves in that window and
// triggers re-hydration from the query cache, which save successes keep
// current via setQueryData.
export function useDemoLayout(enabled: boolean) {
  const hydrate = useDemoLayoutStore((s) => s.hydrate);
  const config = useDemoLayoutStore((s) => s.config);
  const hydrated = useDemoLayoutStore((s) => s.hydrated);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["demo-layout"],
    queryFn: () => getDemoLayoutAction(),
    enabled,
  });
  const save = useMutation({
    mutationFn: async (c: typeof config) => {
      const res = await saveDemoLayoutAction(c);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (_data, saved) => {
      queryClient.setQueryData(["demo-layout"], saved);
    },
  });

  const lastSavedRef = useRef<string>("");
  const configRef = useRef(config);
  const hydratedRef = useRef(hydrated);

  useEffect(() => {
    configRef.current = config;
    hydratedRef.current = hydrated;
  }, [config, hydrated]);

  // Hydrate only from a fetch completed in this mount — cached data from a
  // previous visit may predate saves made since, and hydrating from it would
  // revert the layout and then persist the reversion on the next edit.
  const fetchedFresh = query.isFetchedAfterMount && !query.isError;
  useEffect(() => {
    if (fetchedFresh && query.data !== undefined && !hydrated) {
      lastSavedRef.current = JSON.stringify(mergeDemoLayout(query.data));
      hydrate(query.data);
    }
  }, [fetchedFresh, query.data, hydrated, hydrate]);

  const saveMutate = save.mutate;
  useEffect(() => {
    if (!hydrated) return;
    const serialized = JSON.stringify(config);
    if (serialized === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = serialized;
      saveMutate(config);
    }, 700);
    return () => clearTimeout(t);
  }, [hydrated, config, saveMutate]);

  useEffect(() => {
    return () => {
      if (!hydratedRef.current) return;
      const serialized = JSON.stringify(configRef.current);
      if (serialized === lastSavedRef.current) return;
      lastSavedRef.current = serialized;
      saveMutate(configRef.current);
    };
  }, [saveMutate]);

  return { hydrated: query.isSuccess };
}

// Push layout edits to the live overlay frame the moment they happen, so a
// drag on the Preview tab moves the element in OBS within ~1s (the frame's
// 15s poll is only the fallback).
export function useOverlayLayoutBroadcast(channelSlug: string | null) {
  const config = useDemoLayoutStore((s) => s.config);
  const hydrated = useDemoLayoutStore((s) => s.hydrated);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!channelSlug) return;
    const channel = supabase.channel(overlayLayoutChannelName(channelSlug));
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [channelSlug]);

  useEffect(() => {
    if (!channelSlug || !hydrated) return;
    const timer = setTimeout(() => {
      const channel = channelRef.current;
      if (!channel || channel.state !== "joined") return;
      void channel.send({
        type: "broadcast",
        event: OVERLAY_LAYOUT_EVENT,
        payload: { config },
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [channelSlug, hydrated, config]);
}

export function useOverlayUrlInfo() {
  return useQuery({
    queryKey: ["overlay-url-info"],
    queryFn: async () => {
      const res = await getOverlayUrlInfoAction();
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
  });
}

export function useRegenerateOverlayToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await regenerateOverlayTokenAction();
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["overlay-url-info"], data);
    },
  });
}

export function useDemoFrames(enabled: boolean) {
  return useQuery({
    queryKey: ["demo-frames"],
    queryFn: () => getDemoFramesAction(),
    enabled,
  });
}

// Mirror the demo state to the real OBS overlay pages: while demo is on, the
// current overlay snapshot is broadcast on a realtime channel that the
// /overlay/[channelSlug] pages listen to.
export function useDemoOverlayBroadcast(
  enabled: boolean,
  channelSlug: string | null,
  goals: Counts | null
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !channelSlug) return;
    const channel = supabase.channel(demoOverlayChannelName(channelSlug));
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void channel
        .send({
          type: "broadcast",
          event: DEMO_OVERLAY_EVENT,
          payload: { active: false },
        })
        .finally(() => {
          void supabase.removeChannel(channel);
        });
    };
  }, [enabled, channelSlug]);

  const boxes = useDemoLayoutStore((s) => s.config.boxes);
  const visible = useDemoLayoutStore((s) => s.config.visible);
  const goalProgressFull = useDemoLayoutStore((s) => s.config.goalProgressFull);
  const persist = useDemoLayoutStore((s) => s.persist);
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const messages = useDemoGeneratorStore((s) => s.messages);
  const scores = useDemoGeneratorStore((s) => s.scores);
  const tts = useDemoGeneratorStore((s) => s.tts);
  const asks = useDemoGeneratorStore((s) => s.asks);
  const counts = useDemoGeneratorStore((s) => s.counts);

  useEffect(() => {
    if (!enabled) return;

    const authorFor = (key: string): FeaturedAuthor | null => {
      const viewer = viewers.find((v) => v.key === key);
      if (!viewer) return null;
      return {
        name: viewer.name,
        handle: viewer.handle,
        avatarUrl: viewer.avatarUrl,
        avatarPath: null,
      };
    };
    const standingMap = computeStandings(
      viewers
        .map((v) => ({ id: v.key, score: scores[v.key]?.total ?? 0 }))
        .filter((x) => x.score > 0)
    );
    const standingFor = (key: string) =>
      standingMap.get(key) ?? { rank: 99, progress: 0 };

    const progress = computeGoalProgress(counts, null, goals ?? DEMO_GOAL_TARGETS);
    const metrics = goalProgressFull
      ? {
          subs: reachedProgress(progress.subs),
          likes: reachedProgress(progress.likes),
          viewers: reachedProgress(progress.viewers),
        }
      : progress;

    const snapshot: DemoOverlaySnapshot = {
      active: true,
      boxes,
      visible,
      persist,
      metrics,
      competition: viewers
        .map((v) => ({
          key: v.key,
          author: authorFor(v.key),
          score: scores[v.key]?.total ?? 0,
        }))
        .filter((e) => e.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, OVERLAY_LADDER_MAX),
      highlights: [...messages]
        .reverse()
        .filter((m) => m.promoted && !m.dismissed)
        .map((m) => ({
          id: m.id,
          author: authorFor(m.viewerKey),
          text: m.text,
          ...standingFor(m.viewerKey),
        })),
      tts: tts
        .filter((t) => t.status === "approved")
        .map((t) => ({
          id: t.id,
          author: authorFor(t.viewerKey),
          text: t.text,
          ...standingFor(t.viewerKey),
        })),
      asks: asks
        .filter((a) => a.status === "approved")
        .map((a) => ({
          id: a.id,
          author: authorFor(a.viewerKey),
          question: a.question,
          answer: a.answer,
          includeAnswer: a.includeAnswer,
          ...standingFor(a.viewerKey),
        })),
      // One of each shape, from the viewers the demo already invented, so the
      // streamer can see how a welcome reads before a real chatter triggers one.
      welcomes: viewers.length
        ? [
            {
              id: "demo-welcome-new",
              kind: "new" as const,
              authors: [authorFor(viewers[0].key)].filter((a) => a !== null),
            },
            {
              id: "demo-welcome-batch",
              kind: "batch" as const,
              authors: viewers
                .slice(1, 4)
                .map((v) => authorFor(v.key))
                .filter((a) => a !== null),
            },
          ]
        : [],
    };

    // Debounced: box drags update the store many times per second.
    const timer = setTimeout(() => {
      const channel = channelRef.current;
      if (!channel || channel.state !== "joined") return;
      void channel.send({
        type: "broadcast",
        event: DEMO_OVERLAY_EVENT,
        payload: snapshot,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [
    enabled,
    channelSlug,
    goals,
    boxes,
    visible,
    goalProgressFull,
    persist,
    viewers,
    messages,
    scores,
    tts,
    asks,
    counts,
  ]);
}

// Seed the roster and run the generator while demo is on.
export function useDemoController(enabled: boolean) {
  const seed = useDemoGeneratorStore((s) => s.seed);
  const tick = useDemoGeneratorStore((s) => s.tick);
  useEffect(() => {
    if (!enabled) return;
    seed();
    for (let i = 0; i < 40; i++) tick();
    const id = setInterval(() => tick(), 1600);
    return () => clearInterval(id);
  }, [enabled, seed, tick]);
}

"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import {
  DEMO_OVERLAY_EVENT,
  demoOverlayChannelName,
  type DemoOverlaySnapshot,
} from "@/lib/demo-overlay";
import { computeGoalProgress, reachedProgress, type Counts } from "@/lib/goals";
import { computeStandings } from "@/lib/standings";
import { supabase } from "@/supabase/browser-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  getDemoFramesAction,
  getDemoLayoutAction,
  saveDemoLayoutAction,
} from "./demo.actions";
import { useDemoGeneratorStore, useDemoLayoutStore } from "./demo.stores";
import { DEMO_GOAL_TARGETS, mergeDemoLayout } from "./demo.types";

// Hydrate the layout store from the DB when demo turns on, then debounce-persist
// any changes the owner makes (drag, toggle, background) back to the DB. Saves
// only fire for configs that diverge from the hydrated baseline, so the default
// layout is a display fallback and is never persisted on its own.
export function useDemoLayout(enabled: boolean) {
  const hydrate = useDemoLayoutStore((s) => s.hydrate);
  const config = useDemoLayoutStore((s) => s.config);
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
  });

  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Hydrate only from a fetch completed in this mount — cached data from a
  // previous visit may predate saves made since, and hydrating from it would
  // revert the layout and then persist the reversion on the next edit.
  const fetchedFresh = query.isFetchedAfterMount && !query.isError;
  useEffect(() => {
    if (fetchedFresh && query.data !== undefined && !hydratedRef.current) {
      hydratedRef.current = true;
      lastSavedRef.current = JSON.stringify(mergeDemoLayout(query.data));
      hydrate(query.data);
    }
  }, [fetchedFresh, query.data, hydrate]);

  const saveMutate = save.mutate;
  useEffect(() => {
    if (!hydratedRef.current) return;
    const serialized = JSON.stringify(config);
    if (serialized === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = serialized;
      saveMutate(config);
    }, 700);
    return () => clearTimeout(t);
  }, [config, saveMutate]);

  useEffect(() => {
    return () => {
      if (!hydratedRef.current) return;
      const serialized = JSON.stringify(configRef.current);
      if (serialized === lastSavedRef.current) return;
      lastSavedRef.current = serialized;
      saveMutate(configRef.current);
    };
  }, [saveMutate]);

  useEffect(() => {
    if (!enabled) hydratedRef.current = false;
  }, [enabled]);

  return { hydrated: query.isSuccess };
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
        .slice(0, 18),
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

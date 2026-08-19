"use client";

import { getAuthorIdentityAction } from "@/app/layout.actions";
import type {
  FeaturedAuthor,
  FeaturedMessage,
  FeaturedMessageWithAuthor,
} from "@/app/layout.types";
import {
  mergeDemoLayout,
  type DemoLayoutConfig,
} from "@/app/(app)/live/demo.types";
import {
  DEMO_OVERLAY_EVENT,
  DEMO_OVERLAY_STALE_MS,
  demoOverlayChannelName,
  OVERLAY_LAYOUT_EVENT,
  overlayLayoutChannelName,
  type DemoOverlayEventPayload,
  type DemoOverlaySnapshot,
} from "@/lib/demo-overlay";
import { vidstubeAuthor, youtubeAuthor } from "@/lib/featured-author";
import type { OverlayEvent } from "@/lib/overlay-events";
import { playOverlayChime } from "@/lib/overlay-chime";
import { supabase } from "@/supabase/browser-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getFeaturedMessagesAction,
  getBannerCountsAction,
  getInstalledOverlayAction,
  getMemberCountAction,
  getOverlayLayoutAction,
  getPlayableAskAction,
  getNewestTaskVersionAction,
  getRecentGreetingsAction,
  getPlayableTtsAction,
  getPromotedMessagesAction,
  getStreamStandingsAction,
} from "./page.actions";

// The whole point of the strip is that the number moves when someone chats, so
// it polls on the same 10s cadence the goals use rather than caching for longer.
export function useMemberCount(channelSlug: string, enabled = true) {
  return useQuery({
    queryKey: ["overlay-member-count", channelSlug],
    queryFn: () => getMemberCountAction(channelSlug),
    refetchInterval: 10_000,
    enabled,
  });
}

// Which overlay this channel installed in the game box. On the same 15s cadence
// as the layout, so installing one takes effect on the running browser source
// without the streamer touching OBS.
export function useInstalledOverlay(channelSlug: string, token: string) {
  return useQuery({
    queryKey: ["overlay-installation", channelSlug, token],
    queryFn: () => getInstalledOverlayAction(channelSlug, token),
    refetchInterval: 15_000,
  });
}

// Executed commands belonging to the installed overlay, polled with a cursor.
//
// The cursor lives here, in memory, so a reload starts from the moment of the
// reload. A durable cursor would survive that, and would also mean a browser
// source restarting after an hour delivers an hour of commands at once. Neither
// is obviously right; this is the one that cannot flood the overlay.
const OVERLAY_EVENT_POLL_MS = 2_000;

export function useOverlayEvents(token: string | null) {
  const [events, setEvents] = useState<OverlayEvent[]>([]);
  const since = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const poll = async () => {
      const url = since.current
        ? `/api/overlay/events?since=${encodeURIComponent(since.current)}`
        : "/api/overlay/events";
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error("overlay events refused", response.status);
        return;
      }
      const body = (await response.json()) as { events: OverlayEvent[] };
      if (cancelled || body.events.length === 0) return;
      since.current = body.events[body.events.length - 1].at;
      setEvents(body.events);
    };

    poll().catch((error) => console.error(error));
    const id = setInterval(
      () => poll().catch((error) => console.error(error)),
      OVERLAY_EVENT_POLL_MS
    );
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  return events;
}

// The saved layout drives the whole overlay frame. The 15s poll is the
// fallback; live edits arrive over the layout broadcast channel within ~1s.
export function useLiveOverlayLayout(channelSlug: string, token: string) {
  const query = useQuery({
    queryKey: ["overlay-layout", channelSlug, token],
    queryFn: () => getOverlayLayoutAction(channelSlug, token),
    refetchInterval: 15_000,
  });
  const [pushed, setPushed] = useState<DemoLayoutConfig | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(overlayLayoutChannelName(channelSlug))
      .on("broadcast", { event: OVERLAY_LAYOUT_EVENT }, ({ payload }) => {
        const config = (payload as { config?: Partial<DemoLayoutConfig> })
          ?.config;
        if (config) {
          setPushed(mergeDemoLayout(config));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelSlug]);

  return {
    isSuccess: query.isSuccess,
    authorized: !query.isSuccess || query.data !== null,
    config: query.data ? pushed ?? query.data : null,
  };
}

// While the owner has demo mode on in /live, snapshots of the demo state are
// broadcast on a realtime channel. Any overlay that receives a fresh snapshot
// renders it instead of real data; silence (demo off / tab closed) falls back.
export function useDemoOverlaySnapshot(channelSlug: string) {
  const [snapshot, setSnapshot] = useState<DemoOverlaySnapshot | null>(null);
  const lastAtRef = useRef(0);

  useEffect(() => {
    const channel = supabase
      .channel(demoOverlayChannelName(channelSlug))
      .on("broadcast", { event: DEMO_OVERLAY_EVENT }, ({ payload }) => {
        const data = payload as DemoOverlayEventPayload | undefined;
        if (data?.active) {
          lastAtRef.current = Date.now();
          setSnapshot(data);
        } else {
          lastAtRef.current = 0;
          setSnapshot(null);
        }
      })
      .subscribe();
    const timer = setInterval(() => {
      if (
        lastAtRef.current &&
        Date.now() - lastAtRef.current > DEMO_OVERLAY_STALE_MS
      ) {
        lastAtRef.current = 0;
        setSnapshot(null);
      }
    }, 2000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [channelSlug]);

  return snapshot;
}

// Rings a short bell whenever a new item takes the shared overlay slot, so
// OBS audio signals that a highlight/TTS/ask is starting.
export function useOverlayChime(slotKey: string | null) {
  const lastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!slotKey || slotKey === lastKeyRef.current) return;
    lastKeyRef.current = slotKey;
    playOverlayChime();
  }, [slotKey]);
}

export function useFeaturedMessages(streamId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["featured", streamId],
    queryFn: () => getFeaturedMessagesAction(streamId!),
    enabled: !!streamId,
  });

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`featured:${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "featured_messages",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const row = payload.new as FeaturedMessage;
          let author: FeaturedAuthor | null = null;
          if (row.origin === "youtube") {
            author = youtubeAuthor(row.author_name, row.author_avatar_url);
          } else if (row.user_id) {
            author =
              queryClient
                .getQueryData<FeaturedMessageWithAuthor[]>([
                  "featured",
                  streamId,
                ])
                ?.find((m) => m.user_id === row.user_id && m.author)?.author ??
              null;
          }
          const message: FeaturedMessageWithAuthor = { ...row, author };

          queryClient.setQueryData<FeaturedMessageWithAuthor[]>(
            ["featured", streamId],
            (old = []) =>
              old.some((m) => m.id === message.id) ? old : [...old, message]
          );

          if (!author && row.origin === "vidstube" && row.user_id) {
            const userId = row.user_id;
            getAuthorIdentityAction(userId).then((identity) => {
              const resolved = vidstubeAuthor(identity);
              if (!resolved) return;
              queryClient.setQueryData<FeaturedMessageWithAuthor[]>(
                ["featured", streamId],
                (old = []) =>
                  old.map((m) =>
                    m.id === row.id && !m.author
                      ? { ...m, author: resolved }
                      : m
                  )
              );
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, queryClient]);

  return query;
}

export function usePromotedMessages(streamId: string | null) {
  return useQuery({
    queryKey: ["promoted", streamId],
    queryFn: () => getPromotedMessagesAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 2000,
  });
}

export function useStreamStandings(streamId: string | null) {
  return useQuery({
    queryKey: ["standings", streamId],
    queryFn: () => getStreamStandingsAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 10_000,
  });
}

export function usePlayableTts(streamId: string | null) {
  return useQuery({
    queryKey: ["tts-playable", streamId],
    queryFn: () => getPlayableTtsAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 2000,
  });
}

export function usePlayableAsk(streamId: string | null) {
  return useQuery({
    queryKey: ["ask-playable", streamId],
    queryFn: () => getPlayableAskAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 2000,
  });
}

export function useBannerCounts(channelSlug: string, enabled = true) {
  return useQuery({
    queryKey: ["overlay-banner-counts", channelSlug],
    queryFn: () => getBannerCountsAction(channelSlug),
    refetchInterval: 10_000,
    enabled,
  });
}

// Same cadence as the rest of the feed, so an arrival reaches the broadcast as
// quickly as a highlight does.
export function useRecentGreetings(streamId: string | null) {
  return useQuery({
    queryKey: ["greetings", streamId],
    queryFn: () => getRecentGreetingsAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 2000,
  });
}

// The newest saved version of the task list, polled on the same cadence as the
// rest of the feed so a task ticked off reaches the broadcast as quickly as a
// highlight does.
export function useNewestTaskVersion(streamId: string | null) {
  return useQuery({
    queryKey: ["stream-task-version", streamId],
    queryFn: () => getNewestTaskVersionAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 2000,
  });
}

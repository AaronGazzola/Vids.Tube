"use client";

import { getAuthorIdentityAction } from "@/app/layout.actions";
import type {
  FeaturedAuthor,
  FeaturedMessage,
  FeaturedMessageWithAuthor,
} from "@/app/layout.types";
import {
  DEMO_OVERLAY_EVENT,
  DEMO_OVERLAY_STALE_MS,
  demoOverlayChannelName,
  type DemoOverlayEventPayload,
  type DemoOverlaySnapshot,
} from "@/lib/demo-overlay";
import { vidstubeAuthor, youtubeAuthor } from "@/lib/featured-author";
import { playOverlayChime } from "@/lib/overlay-chime";
import { supabase } from "@/supabase/browser-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getFeaturedMessagesAction,
  getOverlayLayoutAction,
  getPlayableAskAction,
  getPlayableTtsAction,
  getPromotedMessagesAction,
  getStreamStandingsAction,
} from "./page.actions";

// The saved demo-preview layout doubles as the OBS layout: each overlay page
// positions and scales itself from its box on the 1080x1920 canvas.
export function useOverlayLayout(channelSlug: string) {
  return useQuery({
    queryKey: ["overlay-layout", channelSlug],
    queryFn: () => getOverlayLayoutAction(channelSlug),
    refetchInterval: 15_000,
  });
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

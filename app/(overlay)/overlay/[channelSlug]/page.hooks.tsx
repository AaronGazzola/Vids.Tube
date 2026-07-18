"use client";

import { getAuthorIdentityAction } from "@/app/layout.actions";
import type {
  FeaturedAuthor,
  FeaturedMessage,
  FeaturedMessageWithAuthor,
} from "@/app/layout.types";
import { vidstubeAuthor, youtubeAuthor } from "@/lib/featured-author";
import { supabase } from "@/supabase/browser-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  getFeaturedMessagesAction,
  getPlayableAskAction,
  getPlayableTtsAction,
  getPromotedMessagesAction,
  getStreamStandingsAction,
} from "./page.actions";

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

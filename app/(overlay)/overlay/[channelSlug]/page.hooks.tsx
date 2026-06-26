"use client";

import { getAuthorIdentityAction } from "@/app/layout.actions";
import type {
  FeaturedMessage,
  FeaturedMessageWithAuthor,
} from "@/app/layout.types";
import { supabase } from "@/supabase/browser-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getFeaturedMessagesAction } from "./page.actions";

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
          const known = queryClient
            .getQueryData<FeaturedMessageWithAuthor[]>(["featured", streamId])
            ?.find((m) => m.user_id === row.user_id && m.author)?.author;
          const message: FeaturedMessageWithAuthor = {
            ...row,
            author: known ?? null,
          };

          queryClient.setQueryData<FeaturedMessageWithAuthor[]>(
            ["featured", streamId],
            (old = []) =>
              old.some((m) => m.id === message.id) ? old : [...old, message]
          );

          if (!message.author) {
            getAuthorIdentityAction(row.user_id).then((author) => {
              if (!author) return;
              queryClient.setQueryData<FeaturedMessageWithAuthor[]>(
                ["featured", streamId],
                (old = []) =>
                  old.map((m) =>
                    m.id === row.id && !m.author ? { ...m, author } : m
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

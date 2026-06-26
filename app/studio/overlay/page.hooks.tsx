"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getOverlayContextAction,
  getViewerLeaderboardAction,
  setScoringEnabledAction,
} from "./page.actions";

const overlayContextKey = ["overlay-context"] as const;

export function useOverlayContext() {
  return useQuery({
    queryKey: overlayContextKey,
    queryFn: () => getOverlayContextAction(),
    refetchInterval: 15000,
  });
}

export function useSetScoringEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { streamId: string; enabled: boolean }) => {
      const res = await setScoringEnabledAction(input.streamId, input.enabled);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overlayContextKey });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't update featuring"
          message={error.message}
        />
      ));
    },
  });
}

export function useViewerLeaderboard(streamId: string | null) {
  return useQuery({
    queryKey: ["viewer-leaderboard", streamId],
    queryFn: () => getViewerLeaderboardAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 10000,
  });
}

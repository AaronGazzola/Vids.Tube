"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getOverlayContextAction,
  getViewerLeaderboardAction,
  setGoalsAction,
  setScoringEnabledAction,
  setStreamYoutubeVideoAction,
  startGoalsAction,
} from "./overlay.actions";

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

export function useSetStreamYoutubeVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { streamId: string; urlOrId: string }) => {
      const res = await setStreamYoutubeVideoAction(
        input.streamId,
        input.urlOrId
      );
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overlayContextKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="YouTube video saved"
          message="The bot and goal overlays will use this broadcast."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't save YouTube video"
          message={error.message}
        />
      ));
    },
  });
}

export function useSetGoals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      streamId: string;
      targets: { subs: number; likes: number; viewers: number };
    }) => {
      const res = await setGoalsAction(input.streamId, input.targets);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overlayContextKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Goals saved"
          message="The goal overlays will use these targets."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't save goals"
          message={error.message}
        />
      ));
    },
  });
}

export function useStartGoals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { streamId: string }) => {
      const res = await startGoalsAction(input.streamId);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overlayContextKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Goals started"
          message="Baseline captured — subs/likes now measure from here."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't start goals"
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

"use client";

import {
  listOwnerStreamsAction,
  setVideoVisibilityAction,
} from "@/app/(app)/studio/layout.actions";
import type {
  OwnerStream,
  VideoVisibility,
} from "@/app/(app)/studio/layout.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useOwnerStreams() {
  return useQuery<OwnerStream[]>({
    queryKey: ["studio", "owner-streams"],
    queryFn: async () => {
      const res = await listOwnerStreamsAction();
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
  });
}

export function useSetVideoVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      videoId: string;
      visibility: VideoVisibility;
    }) => {
      const res = await setVideoVisibilityAction(vars.videoId, vars.visibility);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["studio", "owner-streams"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getBannedParticipantsAction,
  getYoutubeLinkAction,
  regenerateYoutubeCodeAction,
  saveYoutubeLinkAction,
  unbanParticipantAction,
  unlinkYoutubeAction,
} from "./page.actions";

const bannedKey = ["banned-participants"] as const;

export function useBannedParticipants(enabled: boolean) {
  return useQuery({
    queryKey: bannedKey,
    queryFn: () => getBannedParticipantsAction(),
    enabled,
  });
}

export function useUnbanParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantKey: string) => {
      const res = await unbanParticipantAction(participantKey);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bannedKey });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't unban"
          message={error.message}
        />
      ));
    },
  });
}

const youtubeLinkKey = ["youtube-link"] as const;

export function useYoutubeLink() {
  return useQuery({
    queryKey: youtubeLinkKey,
    queryFn: () => getYoutubeLinkAction(),
  });
}

export function useSaveYoutubeLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (handle: string) => {
      const res = await saveYoutubeLinkAction(handle);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: youtubeLinkKey });
    },
    onError: (error: Error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't link YouTube"
          message={error.message}
        />
      ));
    },
  });
}

export function useRegenerateYoutubeCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await regenerateYoutubeCodeAction();
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: youtubeLinkKey });
    },
    onError: (error: Error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't refresh the code"
          message={error.message}
        />
      ));
    },
  });
}

export function useUnlinkYoutube() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await unlinkYoutubeAction();
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: youtubeLinkKey });
    },
    onError: (error: Error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't unlink"
          message={error.message}
        />
      ));
    },
  });
}

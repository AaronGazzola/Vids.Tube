"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getBannedParticipantsAction,
  unbanParticipantAction,
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

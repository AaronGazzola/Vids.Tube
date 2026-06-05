"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getStreamKeyAction,
  regenerateStreamKeyAction,
} from "./page.actions";

export function useStreamKey() {
  return useQuery({
    queryKey: ["stream-key"],
    queryFn: () => getStreamKeyAction(),
  });
}

export function useRegenerateStreamKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await regenerateStreamKeyAction();
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stream-key"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Stream key regenerated"
          message="Update OBS with the new key before going live."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Could not regenerate key"
          message={error.message}
        />
      ));
    },
  });
}

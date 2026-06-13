"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cancelScheduledBroadcastAction,
  createScheduledBroadcastAction,
  listBroadcastsAction,
  updateScheduledBroadcastAction,
  uploadScheduledBroadcastThumbnailAction,
} from "./page.actions";

const broadcastsKey = ["broadcasts"] as const;

export function useBroadcasts() {
  return useQuery({
    queryKey: broadcastsKey,
    queryFn: () => listBroadcastsAction(),
  });
}

export function useCreateScheduledBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      scheduledStartAt: string;
    }) => {
      const res = await createScheduledBroadcastAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastsKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Broadcast scheduled"
          message="It will show as coming soon on your channel."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't schedule broadcast"
          message={error.message}
        />
      ));
    },
  });
}

export function useUpdateScheduledBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description: string;
      scheduledStartAt: string;
    }) => {
      const res = await updateScheduledBroadcastAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastsKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Broadcast updated"
          message="Your changes have been saved."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't update broadcast"
          message={error.message}
        />
      ));
    },
  });
}

export function useCancelScheduledBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await cancelScheduledBroadcastAction(id);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastsKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Broadcast removed"
          message="It will no longer show as coming soon."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't remove broadcast"
          message={error.message}
        />
      ));
    },
  });
}

export function useUploadScheduledThumbnail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("id", id);
      formData.append("file", file);
      const res = await uploadScheduledBroadcastThumbnailAction(formData);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastsKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Thumbnail updated"
          message="Your broadcast thumbnail is set."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't upload thumbnail"
          message={error.message}
        />
      ));
    },
  });
}

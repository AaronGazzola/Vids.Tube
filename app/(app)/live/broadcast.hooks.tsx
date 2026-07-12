"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  discardBroadcastAction,
  endStreamAction,
  getCurrentBroadcastAction,
  getStreamKeyAction,
  getStreamSettingsAction,
  getTranscriptAction,
  getWorkerStatusAction,
  goLiveAction,
  regenerateStreamKeyAction,
  saveStreamSettingsAction,
  type StreamSettingsInput,
  uploadBroadcastThumbnailAction,
  upsertBroadcastAction,
} from "./broadcast.actions";

const settingsKey = ["stream-settings"] as const;

const broadcastKey = ["current-broadcast"] as const;

export function useStreamKey() {
  return useQuery({
    queryKey: ["stream-key"],
    queryFn: () => getStreamKeyAction(),
  });
}

export function useCurrentBroadcast() {
  return useQuery({
    queryKey: broadcastKey,
    queryFn: () => getCurrentBroadcastAction(),
    refetchInterval: 10000,
  });
}

export function useWorkerStatus() {
  return useQuery({
    queryKey: ["worker-status"],
    queryFn: () => getWorkerStatusAction(),
    refetchInterval: 15000,
  });
}

export function useTranscript(streamId: string | null, live: boolean) {
  return useQuery({
    queryKey: ["transcript", streamId],
    queryFn: () => getTranscriptAction(streamId!),
    enabled: !!streamId && live,
    refetchInterval: 5000,
  });
}

export function useStreamSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => getStreamSettingsAction(),
    refetchInterval: 15000,
  });
}

export function useSaveStreamSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StreamSettingsInput) => {
      const res = await saveStreamSettingsAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKey });
      queryClient.invalidateQueries({ queryKey: broadcastKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Saved"
          message="Your broadcast settings are saved."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't save"
          message={error.message}
        />
      ));
    },
  });
}

export function useUpsertBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      scheduledStartAt: string | null;
    }) => {
      const res = await upsertBroadcastAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKey });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Saved"
          message="Your broadcast settings are saved."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't save"
          message={error.message}
        />
      ));
    },
  });
}

export function useDiscardBroadcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await discardBroadcastAction();
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKey });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't discard"
          message={error.message}
        />
      ));
    },
  });
}

export function useGoLive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { title: string; description: string }) => {
      const res = await goLiveAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKey });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't go live"
          message={error.message}
        />
      ));
    },
  });
}

export function useEndStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await endStreamAction();
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKey });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't end the broadcast"
          message={error.message}
        />
      ));
    },
  });
}

export function useUploadBroadcastThumbnail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadBroadcastThumbnailAction(formData);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKey });
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

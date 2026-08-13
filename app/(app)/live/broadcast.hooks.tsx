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
  getOutstandingRepairsAction,
  getWorkerStatusAction,
  goLiveAction,
  regenerateStreamKeyAction,
  saveStreamSettingsAction,
  setBreakAction,
  type StreamSettingsInput,
  listReusableBroadcastsAction,
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

export function useSetBreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (minutes: number | null) => {
      const res = await setBreakAction(minutes);
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
        <CustomToast variant="error" title="Break" message={error.message} />
      ));
    },
  });
}

export function useWorkerStatus() {
  return useQuery({
    queryKey: ["worker-status"],
    queryFn: () => getWorkerStatusAction(),
    refetchInterval: 15000,
  });
}

export function useOutstandingRepairs() {
  return useQuery({
    queryKey: ["outstanding-repairs"],
    queryFn: () => getOutstandingRepairsAction(),
    refetchInterval: 60000,
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
    // Deliberately silent on success, and deliberately invalidating nothing.
    // This now runs inside the settings save, which refetches and reports for
    // itself; invalidating here is what used to resync the form mid-edit and
    // throw away whatever else the owner had typed.
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

export function useReusableBroadcasts(enabled: boolean) {
  return useQuery({
    queryKey: ["reusable-broadcasts"],
    queryFn: () => listReusableBroadcastsAction(),
    // Fetched only while the dialog is open, so opening /live costs nothing.
    enabled,
    staleTime: 60_000,
  });
}

export function useBroadcastSettingsFor() {
  return useMutation({
    mutationFn: (streamId: string) => getStreamSettingsAction(streamId),
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't load those settings"
          message={error.message}
        />
      ));
    },
  });
}

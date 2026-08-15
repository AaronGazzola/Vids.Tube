"use client";

import { CustomToast } from "@/components/CustomToast";
import type { OverlayInstallation } from "@/lib/overlay-frame";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { OverlaySettings } from "@/lib/overlay-settings";
import {
  getChannelInstallationAction,
  getOverlaySettingsAction,
  installOverlayAction,
  listChannelOverlaysAction,
  removeOverlayAction,
  saveOverlaySettingsAction,
} from "./overlay.actions";

const channelOverlaysKey = ["channel-overlays"] as const;
const channelInstallationKey = ["channel-installation"] as const;

export function useChannelOverlays() {
  return useQuery({
    queryKey: channelOverlaysKey,
    queryFn: () => listChannelOverlaysAction(),
  });
}

// The owner-side surfaces frame whatever the audience surface would frame, so
// the composer cannot show a game the stream is not showing. Undefined until the
// answer arrives: an unanswered question is not an empty answer.
export function useInstalledGameOverlay():
  | OverlayInstallation
  | null
  | undefined {
  const { data } = useQuery({
    queryKey: channelInstallationKey,
    queryFn: () => getChannelInstallationAction(),
  });
  return data;
}

function useInvalidateOverlays() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: channelOverlaysKey });
    queryClient.invalidateQueries({ queryKey: channelInstallationKey });
  };
}

function overlayErrorToast(title: string) {
  return (error: Error) => {
    toast.custom(() => (
      <CustomToast variant="error" title={title} message={error.message} />
    ));
  };
}

export function useOverlaySettings(overlayId: string | null) {
  return useQuery({
    queryKey: ["overlay-settings", overlayId],
    queryFn: () => getOverlaySettingsAction(overlayId!),
    enabled: Boolean(overlayId),
  });
}

export function useSaveOverlaySettings(overlayId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: OverlaySettings) => {
      const res = await saveOverlaySettingsAction(overlayId, values);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overlay-settings", overlayId] });
    },
    onError: overlayErrorToast("Couldn't save the settings"),
  });
}

export function useInstallOverlay() {
  const invalidate = useInvalidateOverlays();
  return useMutation({
    mutationFn: async (overlayId: string) => {
      const res = await installOverlayAction(overlayId);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidate,
    onError: overlayErrorToast("Couldn't install the overlay"),
  });
}

export function useRemoveOverlay() {
  const invalidate = useInvalidateOverlays();
  return useMutation({
    mutationFn: async (overlayId: string) => {
      const res = await removeOverlayAction(overlayId);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidate,
    onError: overlayErrorToast("Couldn't remove the overlay"),
  });
}

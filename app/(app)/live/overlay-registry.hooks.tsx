"use client";

import { CustomToast } from "@/components/CustomToast";
import type { OverlayInstallation } from "@/lib/overlay-frame";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  installOverlayAction,
  listChannelOverlaysAction,
  removeOverlayAction,
} from "./overlay.actions";

const channelOverlaysKey = ["channel-overlays"] as const;

export function useChannelOverlays() {
  return useQuery({
    queryKey: channelOverlaysKey,
    queryFn: () => listChannelOverlaysAction(),
  });
}

// The owner-side surfaces frame whatever the audience surface would frame, so
// the composer cannot show a game the stream is not showing. Undefined until the
// list has loaded: an unanswered question is not an empty answer.
export function useInstalledGameOverlay():
  | OverlayInstallation
  | null
  | undefined {
  const { data } = useChannelOverlays();
  if (!data) {
    return undefined;
  }
  const installed = data.find((o) => o.installId);
  if (!installed?.installId) {
    return null;
  }
  return { installId: installed.installId, entryUrl: installed.entryUrl };
}

function useInvalidateOverlays() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: channelOverlaysKey });
  };
}

function overlayErrorToast(title: string) {
  return (error: Error) => {
    toast.custom(() => (
      <CustomToast variant="error" title={title} message={error.message} />
    ));
  };
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

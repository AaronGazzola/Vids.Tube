"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getChannelBySlugAction,
  getChannelProcessingVideosAction,
  getChannelVideosAction,
  uploadChannelBrandingAction,
} from "./page.actions";

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: () => getChannelBySlugAction(slug),
  });
}

export function useChannelVideos(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-videos", channelId],
    queryFn: () => getChannelVideosAction(channelId!),
    enabled: !!channelId,
  });
}

export function useChannelProcessingVideos(
  channelId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["channel-processing-videos", channelId],
    queryFn: () => getChannelProcessingVideosAction(channelId!),
    enabled: !!channelId && enabled,
    refetchInterval: enabled ? 10_000 : false,
  });
}

export function useUploadChannelBranding(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      kind,
      file,
    }: {
      channelId: string;
      kind: "avatar" | "banner";
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadChannelBrandingAction(channelId, kind, formData);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (_path, { kind }) => {
      queryClient.invalidateQueries({ queryKey: ["channel", slug] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title={kind === "avatar" ? "Avatar updated" : "Banner updated"}
          message="Your channel image has been replaced."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Upload failed"
          message={error.message}
        />
      ));
    },
  });
}

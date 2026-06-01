"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getChannelBySlugAction,
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

export function useUploadChannelBranding(slug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
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
      return uploadChannelBrandingAction(channelId, kind, formData);
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

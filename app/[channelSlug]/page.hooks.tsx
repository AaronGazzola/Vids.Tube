"use client";

import { CustomToast } from "@/components/CustomToast";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  channelHasHostedAction,
  getChannelBySlugAction,
  getChannelCommunityAction,
  getCommunityMemberCountAction,
  getChannelMembershipsAction,
  getChannelProcessingVideosAction,
  getChannelVideosAction,
  getLatestEndedStreamAction,
  getStreamLeaderboardAction,
  getUpcomingScheduledBroadcastAction,
  uploadChannelBrandingAction,
} from "./page.actions";

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: () => getChannelBySlugAction(slug),
  });
}

export function useChannelMemberships(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-memberships", channelId],
    queryFn: () => getChannelMembershipsAction(channelId!),
    enabled: !!channelId,
  });
}

export function useChannelHasHosted(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-has-hosted", channelId],
    queryFn: () => channelHasHostedAction(channelId!),
    enabled: !!channelId,
  });
}

// Paged rather than fetched whole: the leaderboard opens with five and reveals
// the rest in place, so a 143-member community never ships 143 rows to show 5.
export function useChannelCommunity(
  channelId: string | undefined,
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: ["channel-community", channelId],
    queryFn: ({ pageParam }) =>
      getChannelCommunityAction(channelId!, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length : undefined,
    enabled: !!channelId && enabled,
  });
}

// The overlay's count ticks up within seconds of a first message, so the number
// on the channel page has to move too, or the two disagree in front of everyone.
// Polled only while the channel is broadcasting.
export function useCommunityMemberCount(
  channelId: string | undefined,
  live: boolean
) {
  return useQuery({
    queryKey: ["community-member-count", channelId],
    queryFn: () => getCommunityMemberCountAction(channelId!),
    enabled: !!channelId,
    refetchInterval: live ? 15_000 : false,
  });
}

export function useLatestEndedStream(channelId: string | undefined) {
  return useQuery({
    queryKey: ["latest-ended-stream", channelId],
    queryFn: () => getLatestEndedStreamAction(channelId!),
    enabled: !!channelId,
  });
}

// Standing within one broadcast. The live board polls so places move while the
// broadcast runs; a finished broadcast cannot change, so it does not.
export function useStreamLeaderboard(
  streamId: string | null,
  live: boolean,
  enabled = true
) {
  return useInfiniteQuery({
    queryKey: ["stream-leaderboard", streamId],
    queryFn: ({ pageParam }) =>
      getStreamLeaderboardAction(streamId!, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length : undefined,
    enabled: !!streamId && enabled,
    refetchInterval: live ? 20_000 : false,
  });
}

export function useChannelVideos(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-videos", channelId],
    queryFn: () => getChannelVideosAction(channelId!),
    enabled: !!channelId,
  });
}

export function useUpcomingScheduled(channelId: string | undefined) {
  return useQuery({
    queryKey: ["upcoming-scheduled", channelId],
    queryFn: () => getUpcomingScheduledBroadcastAction(channelId!),
    enabled: !!channelId,
    refetchInterval: 30000,
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

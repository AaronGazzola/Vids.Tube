"use client";

import { getFeaturedMessagesAction } from "@/app/(overlay)/overlay/[channelSlug]/page.actions";
import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  approveSuggestionAction,
  banParticipantAction,
  dismissSuggestionAction,
  getModerationFeedAction,
  hideMessageAction,
  promoteHighlightAction,
  setModerationModeAction,
  unbanParticipantAction,
  unhideMessageAction,
} from "./page.actions";

export function useReadThisQueue(streamId: string | null) {
  return useQuery({
    queryKey: ["read-this", streamId],
    queryFn: () => getFeaturedMessagesAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 8000,
  });
}

export function useModerationFeed(streamId: string | null) {
  return useQuery({
    queryKey: ["moderation-feed", streamId],
    queryFn: () => getModerationFeedAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 4000,
  });
}

function errorToast(title: string) {
  return (error: Error) =>
    toast.custom(() => (
      <CustomToast variant="error" title={title} message={error.message} />
    ));
}

function unwrap<T>(res: { data: T } | { error: string }): T {
  if ("error" in res) throw new Error(res.error);
  return res.data;
}

function useModerationInvalidator() {
  const queryClient = useQueryClient();
  return (streamId: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["moderation-feed", streamId] });
    queryClient.invalidateQueries({ queryKey: ["chat", streamId] });
    queryClient.invalidateQueries({ queryKey: ["read-this", streamId] });
    queryClient.invalidateQueries({ queryKey: ["viewer-leaderboard", streamId] });
  };
}

export function usePromoteHighlight(streamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (featuredMessageId: string) =>
      unwrap(await promoteHighlightAction(featuredMessageId)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["read-this", streamId] }),
    onError: errorToast("Couldn't show on overlay"),
  });
}

export function useSetModerationMode(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (mode: "manual" | "auto") =>
      unwrap(await setModerationModeAction(streamId!, mode)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't change moderation mode"),
  });
}

export function useHideMessage(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (chatMessageId: string) =>
      unwrap(await hideMessageAction(streamId!, chatMessageId)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't hide message"),
  });
}

export function useUnhideMessage(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (chatMessageId: string) =>
      unwrap(await unhideMessageAction(streamId!, chatMessageId)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't unhide message"),
  });
}

export function useBanParticipant(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (input: {
      participantKey: string;
      origin: string;
      userId: string | null;
      externalAuthorId: string | null;
      authorName: string | null;
    }) =>
      unwrap(
        await banParticipantAction({ streamId: streamId!, ...input })
      ),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't ban participant"),
  });
}

export function useUnbanParticipant(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (participantKey: string) =>
      unwrap(await unbanParticipantAction(streamId!, participantKey)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't unban participant"),
  });
}

export function useApproveSuggestion(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (actionId: string) =>
      unwrap(await approveSuggestionAction(actionId)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't approve suggestion"),
  });
}

export function useDismissSuggestion(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (actionId: string) =>
      unwrap(await dismissSuggestionAction(actionId)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't dismiss suggestion"),
  });
}

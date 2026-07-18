"use client";

import { getFeaturedMessagesAction } from "@/app/(overlay)/overlay/[channelSlug]/page.actions";
import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  approveAskAction,
  approveSuggestionAction,
  approveTtsAction,
  banParticipantAction,
  dismissAskAction,
  dismissSuggestionAction,
  dismissTtsAction,
  getAskFeedAction,
  getClipMarkersAction,
  getModerationFeedAction,
  getOwnerChatMessagesAction,
  getTtsFeedAction,
  getViewerReasoningAction,
  hideMessageAction,
  manualHighlightAction,
  promoteHighlightAction,
  requestWrapupAction,
  setModerationModeAction,
  unbanParticipantAction,
  unhideMessageAction,
} from "./page.actions";

export function useOwnerChat(streamId: string | null) {
  return useQuery({
    queryKey: ["owner-chat", streamId],
    queryFn: () => getOwnerChatMessagesAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 3000,
  });
}

export type ReasoningIdentity = {
  participantKey: string;
  userId: string | null;
  origin: string;
  externalAuthorId: string | null;
};

export function useViewerReasoning(
  streamId: string | null,
  identity: ReasoningIdentity | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["viewer-reasoning", streamId, identity?.participantKey],
    queryFn: () =>
      getViewerReasoningAction({
        streamId: streamId!,
        userId: identity!.userId,
        origin: identity!.origin,
        externalAuthorId: identity!.externalAuthorId,
      }),
    enabled: enabled && !!streamId && !!identity,
    refetchInterval: enabled ? 8000 : false,
  });
}

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
    queryClient.invalidateQueries({ queryKey: ["owner-chat", streamId] });
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

export function useManualHighlight(streamId: string | null) {
  const invalidate = useModerationInvalidator();
  return useMutation({
    mutationFn: async (chatMessageId: string) =>
      unwrap(await manualHighlightAction(chatMessageId)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't highlight message"),
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
      hidePastMessages?: boolean;
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

export function useTtsFeed(streamId: string | null) {
  return useQuery({
    queryKey: ["tts-feed", streamId],
    queryFn: () => getTtsFeedAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 5000,
  });
}

function useTtsInvalidator() {
  const queryClient = useQueryClient();
  return (streamId: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["tts-feed", streamId] });
  };
}

export function useApproveTts(streamId: string | null) {
  const invalidate = useTtsInvalidator();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await approveTtsAction(id)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't approve the TTS request"),
  });
}

export function useDismissTts(streamId: string | null) {
  const invalidate = useTtsInvalidator();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await dismissTtsAction(id)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't dismiss the TTS request"),
  });
}

export function useAskFeed(streamId: string | null) {
  return useQuery({
    queryKey: ["ask-feed", streamId],
    queryFn: () => getAskFeedAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 5000,
  });
}

function useAskInvalidator() {
  const queryClient = useQueryClient();
  return (streamId: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["ask-feed", streamId] });
  };
}

export function useApproveAsk(streamId: string | null) {
  const invalidate = useAskInvalidator();
  return useMutation({
    mutationFn: async (vars: { id: string; includeAnswer: boolean }) =>
      unwrap(await approveAskAction(vars.id, vars.includeAnswer)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't approve the question"),
  });
}

export function useDismissAsk(streamId: string | null) {
  const invalidate = useAskInvalidator();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await dismissAskAction(id)),
    onSuccess: () => invalidate(streamId),
    onError: errorToast("Couldn't dismiss the question"),
  });
}

export function useClipMarkers(streamId: string | null) {
  return useQuery({
    queryKey: ["clip-markers", streamId],
    queryFn: () => getClipMarkersAction(streamId),
    refetchInterval: 10_000,
  });
}

export function useRequestWrapup(streamId: string | null) {
  return useMutation({
    mutationFn: async () => unwrap(await requestWrapupAction(streamId!)),
    onError: errorToast("Couldn't start the wrap-up"),
  });
}

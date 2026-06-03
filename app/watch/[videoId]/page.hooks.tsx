"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteCommentAction,
  editCommentAction,
  getStreamChatReplayAction,
  getVideoAction,
  listCommentsAction,
  postCommentAction,
  voteCommentAction,
} from "./page.actions";
import { toReplayMessages } from "@/lib/chat-replay";
import type { ScoredComment, VoteValue } from "./page.types";

const commentsKey = (videoId: string) => ["comments", videoId] as const;

export function useVideo(videoId: string) {
  return useQuery({
    queryKey: ["video", videoId],
    queryFn: () => getVideoAction(videoId),
  });
}

export function useChatReplay(streamId: string | null) {
  return useQuery({
    queryKey: ["chat-replay", streamId],
    queryFn: () => getStreamChatReplayAction(streamId!),
    enabled: !!streamId,
    select: toReplayMessages,
  });
}

export function useComments(videoId: string) {
  return useQuery({
    queryKey: commentsKey(videoId),
    queryFn: () => listCommentsAction(videoId),
    enabled: !!videoId,
  });
}

export function usePostComment(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => postCommentAction(videoId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't post comment"
          message={error.message}
        />
      ));
    },
  });
}

export function useEditComment(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      editCommentAction(commentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't edit comment"
          message={error.message}
        />
      ));
    },
  });
}

export function useDeleteComment(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteCommentAction(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't delete comment"
          message={error.message}
        />
      ));
    },
  });
}

type VoteContext = { previous: ScoredComment[] | undefined };

export function useVoteComment(videoId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    { commentId: string; value: VoteValue },
    Error,
    { commentId: string; value: VoteValue },
    VoteContext
  >({
    mutationFn: ({ commentId, value }) =>
      voteCommentAction(commentId, value),
    onMutate: async ({ commentId, value }) => {
      await queryClient.cancelQueries({ queryKey: commentsKey(videoId) });
      const previous = queryClient.getQueryData<ScoredComment[]>(
        commentsKey(videoId)
      );

      if (previous) {
        queryClient.setQueryData<ScoredComment[]>(
          commentsKey(videoId),
          previous.map((c) => {
            if (c.id !== commentId) {
              return c;
            }
            const delta = value - c.viewerVote;
            return {
              ...c,
              viewerVote: value,
              score: c.score + delta,
            };
          })
        );
      }

      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentsKey(videoId), context.previous);
      }
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't record vote"
          message={error.message}
        />
      ));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey(videoId) });
    },
  });
}

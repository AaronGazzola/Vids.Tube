"use server";

import { createClient } from "@/supabase/server-client";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import type { ActionResult } from "@/app/layout.types";
import type {
  ChatReplay,
  Comment,
  ScoredComment,
  Video,
  VoteValue,
} from "./page.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_COMMENT_LENGTH = 4000;

function normalizeBody(body: string): string {
  return body.trim();
}

function isValidBody(body: string): boolean {
  return body.length > 0 && body.length <= MAX_COMMENT_LENGTH;
}

export async function getVideoAction(videoId: string): Promise<Video | null> {
  if (!UUID_RE.test(videoId)) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("status", "ready")
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch video");
  }

  return data;
}

export async function getStreamChatReplayAction(
  streamId: string
): Promise<ChatReplay> {
  if (!UUID_RE.test(streamId)) {
    return { startedAt: null, messages: [] };
  }

  const supabase = await createClient();

  const { data: stream, error: streamError } = await supabase
    .from("streams")
    .select("started_at")
    .eq("id", streamId)
    .maybeSingle();

  if (streamError) {
    console.error(streamError);
    throw new Error("Failed to fetch stream for chat replay");
  }

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select(
      "id, user_id, origin, author_name, author_avatar_url, body, created_at"
    )
    .eq("stream_id", streamId)
    .is("hidden_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch chat replay");
  }

  const rows = messages ?? [];
  const authorByUser = await resolveAuthorIdentities(
    supabase,
    rows.map((m) => m.user_id).filter((id): id is string => !!id)
  );

  return {
    startedAt: stream?.started_at ?? null,
    messages: rows.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      origin: m.origin,
      author: m.user_id ? authorByUser.get(m.user_id) ?? null : null,
      author_name: m.author_name,
      author_avatar_url: m.author_avatar_url,
      body: m.body,
      created_at: m.created_at,
    })),
  };
}

export async function listCommentsAction(
  videoId: string
): Promise<ScoredComment[]> {
  if (!UUID_RE.test(videoId)) {
    return [];
  }

  const supabase = await createClient();

  const { data: comments, error: commentsError } = await supabase
    .from("comments")
    .select("id, video_id, user_id, body, created_at, edited_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false });

  if (commentsError) {
    console.error(commentsError);
    throw new Error("Failed to fetch comments");
  }

  if (!comments || comments.length === 0) {
    return [];
  }

  const commentIds = comments.map((c) => c.id);
  const { data: votes, error: votesError } = await supabase
    .from("comment_votes")
    .select("comment_id, user_id, value")
    .in("comment_id", commentIds);

  if (votesError) {
    console.error(votesError);
    throw new Error("Failed to fetch comment votes");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const scoreByCommentId = new Map<string, number>();
  const viewerVoteByCommentId = new Map<string, VoteValue>();
  for (const vote of votes ?? []) {
    const value = vote.value === 1 || vote.value === -1 ? vote.value : 0;
    scoreByCommentId.set(
      vote.comment_id,
      (scoreByCommentId.get(vote.comment_id) ?? 0) + value
    );
    if (user && vote.user_id === user.id && value !== 0) {
      viewerVoteByCommentId.set(vote.comment_id, value);
    }
  }

  const authorByUser = await resolveAuthorIdentities(
    supabase,
    comments.map((c) => c.user_id)
  );

  return comments.map((c) => ({
    id: c.id,
    videoId: c.video_id,
    userId: c.user_id,
    author: authorByUser.get(c.user_id) ?? null,
    body: c.body,
    createdAt: c.created_at,
    editedAt: c.edited_at,
    score: scoreByCommentId.get(c.id) ?? 0,
    viewerVote: viewerVoteByCommentId.get(c.id) ?? 0,
  }));
}

export async function postCommentAction(
  videoId: string,
  body: string
): Promise<ActionResult<Comment>> {
  const trimmed = normalizeBody(body);
  if (!isValidBody(trimmed)) {
    return { error: "Comment must be between 1 and 4000 characters." };
  }
  if (!UUID_RE.test(videoId)) {
    return { error: "Invalid video id." };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You must be signed in to comment." };
  }

  const { data, error } = await supabase
    .from("comments")
    .insert({
      video_id: videoId,
      user_id: user.id,
      body: trimmed,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to post comment");
  }

  return { data };
}

export async function editCommentAction(
  commentId: string,
  body: string
): Promise<ActionResult<Comment>> {
  const trimmed = normalizeBody(body);
  if (!isValidBody(trimmed)) {
    return { error: "Comment must be between 1 and 4000 characters." };
  }
  if (!UUID_RE.test(commentId)) {
    return { error: "Invalid comment id." };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You must be signed in to edit comments." };
  }

  const { data, error } = await supabase
    .from("comments")
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to edit comment");
  }

  return { data };
}

export async function deleteCommentAction(
  commentId: string
): Promise<ActionResult<{ id: string }>> {
  if (!UUID_RE.test(commentId)) {
    return { error: "Invalid comment id." };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You must be signed in to delete comments." };
  }

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    console.error(error);
    throw new Error("Failed to delete comment");
  }

  return { data: { id: commentId } };
}

export async function voteCommentAction(
  commentId: string,
  value: VoteValue
): Promise<ActionResult<{ commentId: string; value: VoteValue }>> {
  if (!UUID_RE.test(commentId)) {
    return { error: "Invalid comment id." };
  }
  if (value !== -1 && value !== 0 && value !== 1) {
    return { error: "Invalid vote value." };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You must be signed in to vote." };
  }

  if (value === 0) {
    const { error } = await supabase
      .from("comment_votes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    if (error) {
      console.error(error);
      throw new Error("Failed to remove vote");
    }
    return { data: { commentId, value } };
  }

  const { error } = await supabase.from("comment_votes").upsert(
    {
      comment_id: commentId,
      user_id: user.id,
      value,
    },
    { onConflict: "comment_id,user_id" }
  );
  if (error) {
    console.error(error);
    throw new Error("Failed to record vote");
  }

  return { data: { commentId, value } };
}

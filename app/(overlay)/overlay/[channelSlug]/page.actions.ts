"use server";

import type { FeaturedMessageWithAuthor } from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { authorFromRow } from "@/lib/featured-author";
import { createClient } from "@/supabase/server-client";

export async function getFeaturedMessagesAction(
  streamId: string
): Promise<FeaturedMessageWithAuthor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("featured_messages")
    .select("*")
    .eq("stream_id", streamId)
    .order("featured_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch featured messages");
  }

  const userIds = data
    .map((m) => m.user_id)
    .filter((id): id is string => !!id);
  const authorByUser = await resolveAuthorIdentities(supabase, userIds);

  return data.map((m) => ({
    ...m,
    author: authorFromRow(m.origin, m, m.user_id ? authorByUser.get(m.user_id) ?? null : null),
  }));
}

export async function getPromotedMessagesAction(
  streamId: string
): Promise<FeaturedMessageWithAuthor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("featured_messages")
    .select("*")
    .eq("stream_id", streamId)
    .not("promoted_at", "is", null)
    .order("promoted_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch promoted messages");
  }

  const userIds = data
    .map((m) => m.user_id)
    .filter((id): id is string => !!id);
  const authorByUser = await resolveAuthorIdentities(supabase, userIds);

  return data.map((m) => ({
    ...m,
    author: authorFromRow(m.origin, m, m.user_id ? authorByUser.get(m.user_id) ?? null : null),
  }));
}

export async function getStreamStandingsAction(
  streamId: string
): Promise<{ participant_key: string; total_score: number }[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("viewer_scores")
    .select("participant_key, total_score")
    .eq("stream_id", streamId);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch stream standings");
  }

  return data;
}

export type PlayableTts = {
  id: string;
  authorName: string | null;
  text: string;
  audioPath: string;
};

export async function getPlayableTtsAction(
  streamId: string
): Promise<PlayableTts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tts_requests")
    .select("id, author_name, text, audio_path, status")
    .eq("stream_id", streamId)
    .eq("status", "approved")
    .not("audio_path", "is", null)
    .order("approved_at", { ascending: true })
    .limit(10);
  if (error) {
    console.error(error);
    throw new Error("Failed to fetch TTS queue");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    authorName: r.author_name,
    text: r.text,
    audioPath: r.audio_path!,
  }));
}

export async function markTtsPlayedAction(id: string): Promise<void> {
  const { supabaseAdmin } = await import("@/supabase/admin-client");
  const { error } = await supabaseAdmin
    .from("tts_requests")
    .update({ status: "played", played_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved");
  if (error) {
    console.error(error);
    throw new Error("Failed to mark TTS as played");
  }
}

export type PlayableAsk = {
  id: string;
  authorName: string | null;
  question: string;
  answer: string | null;
  includeAnswer: boolean;
};

export async function getPlayableAskAction(
  streamId: string
): Promise<PlayableAsk[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ask_requests")
    .select("id, author_name, question, answer, include_answer, status")
    .eq("stream_id", streamId)
    .eq("status", "approved")
    .order("approved_at", { ascending: true })
    .limit(10);
  if (error) {
    console.error(error);
    throw new Error("Failed to fetch ask queue");
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    authorName: r.author_name,
    question: r.question,
    answer: r.answer,
    includeAnswer: r.include_answer,
  }));
}

export async function markAskShownAction(id: string): Promise<void> {
  const { supabaseAdmin } = await import("@/supabase/admin-client");
  const { error } = await supabaseAdmin
    .from("ask_requests")
    .update({ status: "shown", shown_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved");
  if (error) {
    console.error(error);
    throw new Error("Failed to mark ask as shown");
  }
}

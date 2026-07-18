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
  author: import("@/app/layout.types").FeaturedAuthor | null;
  participantKey: string;
  text: string;
  audioPath: string;
};

type RequestAuthorRow = {
  origin: string;
  participant_key: string;
  author_name: string | null;
  chat_message_id: string | null;
};

async function resolveRequestAuthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: RequestAuthorRow[]
): Promise<Map<RequestAuthorRow, ReturnType<typeof authorFromRow>>> {
  const msgIds = rows
    .map((r) => r.chat_message_id)
    .filter((id): id is string => !!id);
  const avatarByMsg = new Map<string, string | null>();
  if (msgIds.length) {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, author_avatar_url")
      .in("id", msgIds);
    for (const m of data ?? []) {
      avatarByMsg.set(m.id, m.author_avatar_url);
    }
  }
  const userIds = rows
    .filter((r) => r.origin === "vidstube")
    .map((r) => r.participant_key);
  const identities = await resolveAuthorIdentities(supabase, userIds);

  const out = new Map<RequestAuthorRow, ReturnType<typeof authorFromRow>>();
  for (const r of rows) {
    out.set(
      r,
      authorFromRow(
        r.origin,
        {
          author_name: r.author_name,
          author_avatar_url: r.chat_message_id
            ? avatarByMsg.get(r.chat_message_id) ?? null
            : null,
        },
        r.origin === "vidstube"
          ? identities.get(r.participant_key) ?? null
          : null
      )
    );
  }
  return out;
}

export async function getPlayableTtsAction(
  streamId: string
): Promise<PlayableTts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tts_requests")
    .select(
      "id, author_name, origin, participant_key, chat_message_id, text, audio_path, status"
    )
    .eq("stream_id", streamId)
    .eq("status", "approved")
    .not("audio_path", "is", null)
    .order("approved_at", { ascending: true })
    .limit(10);
  if (error) {
    console.error(error);
    throw new Error("Failed to fetch TTS queue");
  }
  const rows = data ?? [];
  const authors = await resolveRequestAuthors(supabase, rows);
  return rows.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    author: authors.get(r) ?? null,
    participantKey: r.participant_key,
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
  author: import("@/app/layout.types").FeaturedAuthor | null;
  participantKey: string;
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
    .select(
      "id, author_name, origin, participant_key, chat_message_id, question, answer, include_answer, status"
    )
    .eq("stream_id", streamId)
    .eq("status", "approved")
    .order("approved_at", { ascending: true })
    .limit(10);
  if (error) {
    console.error(error);
    throw new Error("Failed to fetch ask queue");
  }
  const rows = data ?? [];
  const authors = await resolveRequestAuthors(supabase, rows);
  return rows.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    author: authors.get(r) ?? null,
    participantKey: r.participant_key,
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

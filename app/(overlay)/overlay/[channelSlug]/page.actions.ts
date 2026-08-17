"use server";

import {
  mergeDemoLayout,
  type DemoLayoutConfig,
} from "@/app/(app)/live/demo.types";
import type {
  FeaturedAuthor,
  FeaturedMessageWithAuthor,
} from "@/app/layout.types";
import { resolveAuthorIdentities } from "@/lib/author-identity";
import { channelAvatarUrl } from "@/lib/storage";
import type { OverlayInstallation } from "@/lib/overlay-frame";
import { installationForChannel } from "@/lib/overlay-installation";
import { authorFromRow } from "@/lib/featured-author";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

export async function getOverlayLayoutAction(
  channelSlug: string,
  token: string
): Promise<DemoLayoutConfig | null> {
  const { data: channel, error: channelError } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to fetch channel");
  }
  if (!channel) {
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("overlay_layouts")
    .select("config, token")
    .eq("channel_id", channel.id)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to fetch overlay layout");
  }
  if (!data || data.token !== token) {
    return null;
  }
  return mergeDemoLayout(
    (data.config as Partial<DemoLayoutConfig> | null) ?? null
  );
}

export async function getInstalledOverlayAction(
  channelSlug: string,
  token: string
): Promise<OverlayInstallation | null> {
  const { data: channel, error: channelError } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to fetch channel");
  }
  if (!channel) {
    return null;
  }
  const { data: layout, error: layoutError } = await supabaseAdmin
    .from("overlay_layouts")
    .select("token")
    .eq("channel_id", channel.id)
    .maybeSingle();
  if (layoutError) {
    console.error(layoutError);
    throw new Error("Failed to fetch overlay layout");
  }
  if (!layout || layout.token !== token) {
    return null;
  }
  return installationForChannel(channel.id);
}

export async function getMemberCountAction(
  channelSlug: string
): Promise<number> {
  const { data: channel, error: channelError } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to fetch channel");
  }
  if (!channel) {
    return 0;
  }
  // One definition of "member", shared with the channel page and the greeting,
  // so the number on stream cannot disagree with the number on the page.
  const { data, error } = await supabaseAdmin.rpc("community_member_count", {
    p_community: channel.id,
  });
  if (error) {
    console.error(error);
    throw new Error("Failed to count members");
  }
  return data ?? 0;
}

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
    .is("shown_at", null)
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
  approvedAt: string | null;
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
      "id, author_name, origin, participant_key, chat_message_id, text, audio_path, status, approved_at"
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
    approvedAt: r.approved_at,
  }));
}

export async function markHighlightShownAction(id: string): Promise<void> {
  const { supabaseAdmin } = await import("@/supabase/admin-client");
  const { error } = await supabaseAdmin
    .from("featured_messages")
    .update({ shown_at: new Date().toISOString() })
    .eq("id", id)
    .is("shown_at", null);
  if (error) {
    console.error(error);
    throw new Error("Failed to mark highlight as shown");
  }
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

export type BannerCounts = {
  chattersThisStream: number | null;
  chatsThisStream: number | null;
  commandsThisStream: number | null;
  newMembersThisStream: number | null;
};

// The three banner metrics that no other overlay needed.
//
// A chatter becomes a membership on their first message, so counting membership
// rows counts everyone who has ever chatted here. That is deliberately wider
// than the member count, which excludes bots and accounts with no YouTube
// identity — the two numbers are meant to differ.
export async function getBannerCountsAction(
  channelSlug: string
): Promise<BannerCounts> {
  const { data: channel } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", channelSlug)
    .maybeSingle();
  if (!channel) {
    return {
      chattersThisStream: null,
      chatsThisStream: null,
      commandsThisStream: null,
      newMembersThisStream: null,
    };
  }

  // Null rather than zero off air: nobody has joined "this stream" when there
  // is no stream, and zero would be a claim.
  const { data: streamRow } = await supabaseAdmin
    .from("streams")
    .select("id, started_at")
    .eq("channel_id", channel.id)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Everything per-broadcast is null off air rather than zero: there is no
  // broadcast to have counted anything in.
  let chatters: number | null = null;
  let chats: number | null = null;
  let commands: number | null = null;
  let newMembers: number | null = null;
  if (streamRow?.id) {
    const { count: chatCount } = await supabaseAdmin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", streamRow.id);
    chats = chatCount ?? 0;

    // Counted from the chat itself, so it is true while the broadcast runs
    // rather than only once the post-broadcast pass has rebuilt aggregates.
    const { data: uniqueChatters } = await supabaseAdmin.rpc(
      "stream_unique_chatters",
      { p_stream: streamRow.id }
    );
    chatters = uniqueChatters ?? 0;

    // Commands as they were used, which is what moves while streaming, not the
    // list of commands the channel has available.
    const { count: commandCount } = await supabaseAdmin
      .from("command_events")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", streamRow.id);
    commands = commandCount ?? 0;
  }
  if (streamRow?.started_at) {
    const { count } = await supabaseAdmin
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("community_channel_id", channel.id)
      .gte("first_seen_at", streamRow.started_at);
    newMembers = count ?? 0;
  }

  return {
    chattersThisStream: chatters,
    chatsThisStream: chats,
    commandsThisStream: commands,
    newMembersThisStream: newMembers,
  };
}

// A greeting the broadcast should show. Read through row-level security like
// every other overlay read: `stream_greetings` is readable exactly while its
// broadcast is live, so a finished broadcast's arrivals stay closed without this
// action having to remember to check. The time bound below is a query bound, not
// the security boundary.
export type OverlayGreeting = {
  channelId: string;
  kind: "new" | "returning" | "batch";
  greetedAt: string;
  author: FeaturedAuthor;
};

const GREETING_WINDOW_MS = 5 * 60_000;

export async function getRecentGreetingsAction(
  streamId: string
): Promise<OverlayGreeting[]> {
  const supabase = await createClient();

  const since = new Date(Date.now() - GREETING_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("stream_greetings")
    .select(
      "channel_id, kind, greeted_at, channels!inner(name, handle, avatar_path, remote_avatar_path)"
    )
    .eq("stream_id", streamId)
    .gte("greeted_at", since)
    .order("greeted_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch greetings");
  }

  return (data ?? []).map((row) => {
    const channel = row.channels as unknown as {
      name: string | null;
      handle: string | null;
      avatar_path: string | null;
      remote_avatar_path: string | null;
    };
    return {
      channelId: row.channel_id,
      kind: row.kind as OverlayGreeting["kind"],
      greetedAt: row.greeted_at,
      author: {
        name: channel.name ?? channel.handle ?? "viewer",
        handle: channel.handle,
        avatarUrl: channelAvatarUrl(channel),
        avatarPath: null,
      },
    };
  });
}

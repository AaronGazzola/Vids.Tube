"use server";

import { createClient } from "@/supabase/server-client";
import { SCHEDULED_CLAIM_GRACE_MS, STALE_MS, isStreamPublic } from "@/lib/stream";
import type { ActionResult, Stream } from "@/app/layout.types";
import {
  COMMUNITY_PAGE_SIZE,
  type Channel,
  type ChannelMembership,
  type CommunityMember,
  type MembershipBadge,
  type Video,
} from "./page.types";

export async function getUpcomingScheduledBroadcastAction(
  channelId: string
): Promise<Stream | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("channel_id", channelId)
    .in("status", ["scheduled", "preview"])
    .order("scheduled_start_at", { ascending: true });

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch scheduled broadcast");
  }

  // Only dated scheduled/preview rows are public. An undated draft or an ad-hoc
  // preview (created by the encoder, no datetime) stays private until go-live.
  const rows = (data ?? []).filter(isStreamPublic);
  const now = Date.now();

  const connectedPreview = rows
    .filter(
      (row) =>
        row.status === "preview" &&
        now - (row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0) <=
          STALE_MS
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

  if (connectedPreview) {
    return connectedPreview;
  }

  const upcoming = rows.find(
    (row) =>
      row.status === "scheduled" &&
      (!row.scheduled_start_at ||
        new Date(row.scheduled_start_at).getTime() >=
          now - SCHEDULED_CLAIM_GRACE_MS)
  );

  return upcoming ?? null;
}

export async function getChannelBySlugAction(
  slug: string
): Promise<(Channel & { redirectToSlug?: string | null }) | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch channel");
  }

  if (!data) {
    return null;
  }

  if (data.merged_into_channel_id) {
    const { data: survivor, error: survivorError } = await supabase
      .from("channels")
      .select("slug")
      .eq("id", data.merged_into_channel_id)
      .maybeSingle();
    if (survivorError) {
      console.error(survivorError);
      throw new Error("Failed to resolve merged channel");
    }
    return { ...data, redirectToSlug: survivor?.slug ?? null };
  }

  return data;
}

export async function getChannelMembershipsAction(
  channelId: string
): Promise<ChannelMembership[]> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("memberships")
    .select(
      "id, community_channel_id, level, lifetime_xp, credits, message_count, streams_attended, current_streak, best_streak, first_seen_at, last_seen_at"
    )
    .eq("channel_id", channelId)
    .order("lifetime_xp", { ascending: false });
  if (error) {
    console.error(error);
    throw new Error("Failed to load memberships");
  }
  if (!rows?.length) {
    return [];
  }

  const communityIds = rows.map((r) => r.community_channel_id);

  const { data: communities, error: commErr } = await supabase
    .from("channels")
    .select("id, slug, name, avatar_path, remote_avatar_path")
    .in("id", communityIds);
  if (commErr) {
    console.error(commErr);
    throw new Error("Failed to load communities");
  }
  const communityById = new Map((communities ?? []).map((c) => [c.id, c]));

  const { data: liveStreams } = await supabase
    .from("streams")
    .select("channel_id")
    .in("channel_id", communityIds)
    .eq("status", "live");
  const liveIds = new Set((liveStreams ?? []).map((s) => s.channel_id));

  const { data: awards, error: awardErr } = await supabase
    .from("membership_badges")
    .select("membership_id, awarded_at, badges(key, title, description)")
    .in(
      "membership_id",
      rows.map((r) => r.id)
    );
  if (awardErr) {
    console.error(awardErr);
    throw new Error("Failed to load badges");
  }
  const badgesByMembership = new Map<string, MembershipBadge[]>();
  for (const a of awards ?? []) {
    const badge = a.badges as unknown as {
      key: string;
      title: string;
      description: string;
    } | null;
    if (!badge) continue;
    const list = badgesByMembership.get(a.membership_id) ?? [];
    list.push({ ...badge, awardedAt: a.awarded_at });
    badgesByMembership.set(a.membership_id, list);
  }

  const ranks = await Promise.all(
    rows.map(async (r) => {
      if (r.lifetime_xp <= 0) return null;
      const { data } = await supabase.rpc("membership_rank", {
        p_membership: r.id,
      });
      return data ?? null;
    })
  );

  const memberships: ChannelMembership[] = rows.map((r, i) => {
    const community = communityById.get(r.community_channel_id);
    return {
      id: r.id,
      communityId: r.community_channel_id,
      communitySlug: community?.slug ?? "",
      communityName: community?.name ?? "Unknown channel",
      communityAvatarPath: community?.avatar_path ?? null,
      communityRemoteAvatarPath: community?.remote_avatar_path ?? null,
      isLive: liveIds.has(r.community_channel_id),
      level: r.level,
      lifetimeXp: r.lifetime_xp,
      credits: Number(r.credits),
      messageCount: r.message_count,
      streamsAttended: r.streams_attended,
      currentStreak: r.current_streak,
      bestStreak: r.best_streak,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      rank: ranks[i],
      badges: badgesByMembership.get(r.id) ?? [],
    };
  });

  // A chatter arriving from a greeting during a broadcast finds the community
  // they are watching at the top of their list.
  return memberships.sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    return b.lifetimeXp - a.lifetimeXp;
  });
}

async function badgesFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membershipIds: string[]
): Promise<Map<string, MembershipBadge[]>> {
  const byMembership = new Map<string, MembershipBadge[]>();
  if (!membershipIds.length) {
    return byMembership;
  }
  const { data, error } = await supabase
    .from("membership_badges")
    .select("membership_id, awarded_at, badges(key, title, description)")
    .in("membership_id", membershipIds);
  if (error) {
    console.error(error);
    return byMembership;
  }
  for (const a of data ?? []) {
    const badge = a.badges as unknown as {
      key: string;
      title: string;
      description: string;
    } | null;
    if (!badge) continue;
    const list = byMembership.get(a.membership_id) ?? [];
    list.push({ ...badge, awardedAt: a.awarded_at });
    byMembership.set(a.membership_id, list);
  }
  return byMembership;
}

export async function getChannelCommunityAction(
  channelId: string,
  page = 0
): Promise<{ total: number; members: CommunityMember[]; hasMore: boolean }> {
  const supabase = await createClient();

  const { data: total, error: countErr } = await supabase.rpc(
    "community_member_count",
    { p_community: channelId }
  );
  if (countErr) {
    console.error(countErr);
    throw new Error("Failed to count members");
  }

  const from = page * COMMUNITY_PAGE_SIZE;
  const { data: rows, error } = await supabase
    .from("memberships")
    .select(
      "id, channel_id, level, lifetime_xp, channels!memberships_channel_id_fkey(handle, name, avatar_path, remote_avatar_path, youtube_channel_id, is_software)"
    )
    .eq("community_channel_id", channelId)
    .order("lifetime_xp", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + COMMUNITY_PAGE_SIZE * 4);
  if (error) {
    console.error(error);
    throw new Error("Failed to load community members");
  }

  // The member definition lives in the database, but a paged listing still has
  // to apply it here: software and account-only memberships must not consume a
  // slot in the page or the counts and the list would disagree.
  type MemberChannel = {
    handle: string;
    name: string;
    avatar_path: string | null;
    remote_avatar_path: string | null;
    youtube_channel_id: string | null;
    is_software: boolean;
  };
  const eligible = (rows ?? []).filter((r) => {
    const c = r.channels as unknown as MemberChannel | null;
    return !!c && !!c.youtube_channel_id && !c.is_software;
  });
  const pageRows = eligible.slice(0, COMMUNITY_PAGE_SIZE);

  const badgesByMembership = await badgesFor(
    supabase,
    pageRows.map((r) => r.id)
  );

  const members: CommunityMember[] = pageRows.map((r) => {
    const c = r.channels as unknown as MemberChannel;
    return {
      membershipId: r.id,
      channelId: r.channel_id,
      handle: c.handle,
      name: c.name,
      avatarPath: c.avatar_path,
      remoteAvatarPath: c.remote_avatar_path,
      level: r.level,
      lifetimeXp: r.lifetime_xp,
      badges: badgesByMembership.get(r.id) ?? [],
    };
  });

  return {
    total: total ?? 0,
    members,
    hasMore: from + members.length < (total ?? 0) && members.length > 0,
  };
}

// Split out from the leaderboard so the total can be polled cheaply during a
// broadcast without refetching every loaded page of members.
export async function getCommunityMemberCountAction(
  channelId: string
): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_member_count", {
    p_community: channelId,
  });
  if (error) {
    console.error(error);
    throw new Error("Failed to count members");
  }
  return data ?? 0;
}

// Standing within one broadcast, ordered by the XP earned in it and then by how
// much was said, so someone who chatted without scoring still appears rather
// than vanishing from the board of the stream they took part in.
export async function getStreamLeaderboardAction(
  streamId: string,
  page = 0
): Promise<{ total: number; members: CommunityMember[]; hasMore: boolean }> {
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("membership_stream_stats")
    .select(
      "membership_id, xp, message_count, memberships!inner(id, channel_id, level, lifetime_xp, channels!memberships_channel_id_fkey!inner(handle, name, avatar_path, remote_avatar_path, youtube_channel_id, is_software))"
    )
    .eq("stream_id", streamId)
    .order("xp", { ascending: false })
    .order("message_count", { ascending: false });
  if (error) {
    console.error(error);
    throw new Error("Failed to load the broadcast leaderboard");
  }

  type Joined = {
    membership_id: string;
    xp: number;
    message_count: number;
    memberships: {
      id: string;
      channel_id: string;
      level: number;
      lifetime_xp: number;
      channels: {
        handle: string;
        name: string;
        avatar_path: string | null;
        remote_avatar_path: string | null;
        youtube_channel_id: string | null;
        is_software: boolean;
      } | null;
    } | null;
  };

  const eligible = (rows as unknown as Joined[]).filter((r) => {
    const c = r.memberships?.channels;
    return !!c && !!c.youtube_channel_id && !c.is_software;
  });

  const from = page * COMMUNITY_PAGE_SIZE;
  const pageRows = eligible.slice(from, from + COMMUNITY_PAGE_SIZE);

  const badgesByMembership = await badgesFor(
    supabase,
    pageRows.map((r) => r.membership_id)
  );

  const members: CommunityMember[] = pageRows.map((r) => {
    const m = r.memberships!;
    const c = m.channels!;
    return {
      membershipId: m.id,
      channelId: m.channel_id,
      handle: c.handle,
      name: c.name,
      avatarPath: c.avatar_path,
      remoteAvatarPath: c.remote_avatar_path,
      level: m.level,
      lifetimeXp: m.lifetime_xp,
      streamXp: r.xp,
      streamMessageCount: r.message_count,
      badges: badgesByMembership.get(m.id) ?? [],
    };
  });

  return {
    total: eligible.length,
    members,
    hasMore: from + members.length < eligible.length && members.length > 0,
  };
}

// The most recent broadcast that has finished, used for the latest-stream board.
export async function getLatestEndedStreamAction(
  channelId: string
): Promise<{ id: string; title: string | null; startedAt: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("streams")
    .select("id, title, started_at")
    .eq("channel_id", channelId)
    .eq("status", "ended")
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load the latest broadcast");
  }
  return data
    ? { id: data.id, title: data.title, startedAt: data.started_at }
    : null;
}

export async function channelHasHostedAction(
  channelId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", channelId);
  if (error) {
    console.error(error);
    throw new Error("Failed to check broadcast history");
  }
  return (count ?? 0) > 0;
}

export async function getChannelVideosAction(
  channelId: string
): Promise<Video[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The read policy lets an unlisted recording through, so that it can be
  // reached by its own address. Keeping it out of listings is this query's job.
  // The owner sees their own withheld recordings here, labelled, so a withheld
  // recording is never mistaken for a missing one.
  const query = supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channelId)
    .eq("status", "ready")
    .order("published_at", { ascending: false });

  const { data, error } = user
    ? await query
    : await query.eq("visibility", "public");

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch channel videos");
  }

  if (!user) return data ?? [];

  // A signed-in visitor who is not the owner reads only public rows here; the
  // policy already withheld private ones, and unlisted ones are filtered now.
  const { data: owned } = await supabase
    .from("channels")
    .select("id")
    .eq("id", channelId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  return (data ?? []).filter(
    (v) => v.visibility === "public" || !!owned
  );
}

export async function getChannelProcessingVideosAction(
  channelId: string
): Promise<Video[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channelId)
    .in("status", ["processing", "failed"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch processing videos");
  }

  return data ?? [];
}

const BRANDING_BUCKET = "channel-assets";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE: Record<"avatar" | "banner", number> = {
  avatar: 2 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
};

export async function uploadChannelBrandingAction(
  channelId: string,
  kind: "avatar" | "banner",
  formData: FormData
): Promise<ActionResult<string>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(authError);
    return { error: "You must be signed in." };
  }
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id, owner_user_id, avatar_path, banner_path")
    .eq("id", channelId)
    .maybeSingle();

  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "Channel not found." };
  }
  if (channel.owner_user_id !== user.id) {
    return { error: "You're not authorized to edit this channel." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided." };
  }

  const ext = MIME_EXT[file.type];
  if (!ext) {
    return { error: "Unsupported file type — use JPG, PNG, or WebP." };
  }

  if (file.size > MAX_SIZE[kind]) {
    const limitMb = MAX_SIZE[kind] / (1024 * 1024);
    return {
      error: `File too large — ${kind} must be ${limitMb} MB or smaller.`,
    };
  }

  const path = `${channelId}/${kind}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    throw new Error("Failed to upload image");
  }

  const previousPath =
    kind === "avatar" ? channel.avatar_path : channel.banner_path;

  const update =
    kind === "avatar" ? { avatar_path: path } : { banner_path: path };

  const { error: updateError } = await supabase
    .from("channels")
    .update(update)
    .eq("id", channelId);

  if (updateError) {
    console.error(updateError);
    await supabase.storage.from(BRANDING_BUCKET).remove([path]);
    throw new Error("Failed to save image");
  }

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .remove([previousPath]);
    if (removeError) {
      console.error(removeError);
    }
  }

  return { data: path };
}

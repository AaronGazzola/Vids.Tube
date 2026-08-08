import type { Database } from "@/supabase/types";

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Video = Database["public"]["Tables"]["videos"]["Row"];

export type MembershipBadge = {
  key: string;
  title: string;
  description: string;
  awardedAt: string;
};

export type ChannelMembership = {
  id: string;
  communityId: string;
  communitySlug: string;
  communityName: string;
  communityAvatarPath: string | null;
  communityRemoteAvatarPath: string | null;
  isLive: boolean;
  level: number;
  lifetimeXp: number;
  credits: number;
  messageCount: number;
  streamsAttended: number;
  currentStreak: number;
  bestStreak: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  // Withheld while lifetime XP is zero: with most members tied on zero, a true
  // rank reads as a position at the bottom of a crowd of ties.
  rank: number | null;
  badges: MembershipBadge[];
};

export type CommunityMember = {
  membershipId: string;
  channelId: string;
  handle: string;
  name: string;
  avatarPath: string | null;
  remoteAvatarPath: string | null;
  level: number;
  lifetimeXp: number;
  // Set only on a per-broadcast board, where standing is what was earned in that
  // one broadcast rather than across the member's whole history.
  streamXp?: number;
  streamMessageCount?: number;
  badges: MembershipBadge[];
};

export const COMMUNITY_PAGE_SIZE = 5;

export type CommunityScopeKey = "all" | "latest" | "live";

export type CommunityScope = {
  key: CommunityScopeKey;
  label: string;
  streamId: string | null;
};

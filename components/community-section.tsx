"use client";

import {
  useChannelCommunity,
  useCommunityMemberCount,
  useLatestEndedStream,
  useStreamLeaderboard,
} from "@/app/[channelSlug]/page.hooks";
import type {
  CommunityMember,
  CommunityScopeKey,
} from "@/app/[channelSlug]/page.types";
import { useLiveStream } from "@/app/layout.hooks";
import { BadgeChip } from "@/components/badge-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { channelAvatarUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function memberHref(member: CommunityMember, communitySlug: string): string {
  return `/${member.handle}?c=${communitySlug}`;
}

function MemberAvatar({
  member,
  className = "h-7 w-7",
}: {
  member: CommunityMember;
  className?: string;
}) {
  const url = channelAvatarUrl({
    avatar_path: member.avatarPath,
    remote_avatar_path: member.remoteAvatarPath,
  });
  return (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={member.name} />}
      <AvatarFallback className="text-[10px]">
        {initials(member.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function ScopeTab({
  active,
  live,
  onSelect,
  children,
}: {
  active: boolean;
  live?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-foreground/20 bg-foreground text-background"
          : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
        // The live board is the only one that changes while you watch it, so it
        // carries the same red the rest of the product uses for "on air".
        live &&
          (active
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "border-destructive/60 bg-transparent text-destructive hover:text-destructive")
      )}
    >
      {live && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            active ? "bg-destructive-foreground" : "bg-destructive"
          )}
        />
      )}
      {children}
    </button>
  );
}

function Standing({ member }: { member: CommunityMember }) {
  // A per-broadcast board shows what was earned in that broadcast; the all-time
  // board shows the level and total the member carries.
  if (member.streamXp !== undefined) {
    return (
      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
        {member.streamXp.toLocaleString("en-US")} XP ·{" "}
        {member.streamMessageCount?.toLocaleString("en-US") ?? 0} msg
      </span>
    );
  }
  return (
    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
      lvl {member.level} · {member.lifetimeXp.toLocaleString("en-US")} XP
    </span>
  );
}

export function CommunitySection({
  channelId,
  channelSlug,
}: {
  channelId: string;
  channelSlug: string;
}) {
  const { data: stream } = useLiveStream(channelId);
  const isLive = stream?.status === "live";
  const liveStreamId = isLive ? stream.id : null;
  const { data: latestEnded } = useLatestEndedStream(channelId);

  // Only the reader's own choice is stored. Which tab is actually shown is
  // derived, so going live, a broadcast ending, or a tab disappearing needs no
  // effect to keep the selection honest — and cannot leave it pointing at a tab
  // that is no longer offered.
  const [chosen, setChosen] = useState<CommunityScopeKey | null>(null);

  const available: Record<CommunityScopeKey, boolean> = {
    all: true,
    latest: !!latestEnded,
    live: isLive,
  };
  // A broadcast in progress is the thing worth opening on.
  const preferred: CommunityScopeKey = isLive ? "live" : "all";
  const scope = chosen && available[chosen] ? chosen : preferred;

  const allTime = useChannelCommunity(channelId, scope === "all");
  const liveBoard = useStreamLeaderboard(liveStreamId, true, scope === "live");
  const latestBoard = useStreamLeaderboard(
    latestEnded?.id ?? null,
    false,
    scope === "latest"
  );

  const board =
    scope === "live" ? liveBoard : scope === "latest" ? latestBoard : allTime;

  const { data: polledTotal } = useCommunityMemberCount(channelId, isLive);
  const memberTotal = polledTotal ?? allTime.data?.pages[0]?.total ?? 0;
  const scopeTotal = board.data?.pages[0]?.total ?? 0;
  const members = board.data?.pages.flatMap((p) => p.members) ?? [];

  const emptyMessage =
    scope === "live"
      ? "Nobody has chatted yet this broadcast. Send a message to be the first."
      : scope === "latest"
        ? "Nobody chatted in that broadcast."
        : "No members yet. Send a message in chat during a broadcast to join.";

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Community</h2>
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">
            {memberTotal.toLocaleString("en-US")}
          </span>{" "}
          {memberTotal === 1 ? "member" : "members"}
        </span>
      </div>

      <div role="tablist" className="mb-3 flex flex-wrap items-center gap-2">
        <ScopeTab active={scope === "all"} onSelect={() => setChosen("all")}>
          All time
        </ScopeTab>
        {!!latestEnded && (
          <ScopeTab
            active={scope === "latest"}
            onSelect={() => setChosen("latest")}
          >
            Latest stream
          </ScopeTab>
        )}
        {isLive && (
          <ScopeTab
            active={scope === "live"}
            live
            onSelect={() => setChosen("live")}
          >
            Now live
          </ScopeTab>
        )}
        {scope !== "all" && scopeTotal > 0 && (
          <span className="text-xs text-muted-foreground">
            {scopeTotal.toLocaleString("en-US")}{" "}
            {scopeTotal === 1 ? "person" : "people"} took part
          </span>
        )}
      </div>

      <div
        className={cn(
          "rounded-xl border",
          scope === "live" && "border-destructive/40"
        )}
      >
        {board.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : members.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="divide-y">
            {members.map((member, i) => (
              <li key={member.membershipId}>
                <Link
                  href={memberHref(member, channelSlug)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50"
                >
                  <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <MemberAvatar member={member} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {member.name}
                  </span>
                  <Standing member={member} />
                  <span className="hidden shrink-0 gap-1 sm:flex">
                    {member.badges.map((badge) => (
                      <BadgeChip key={badge.key} badge={badge} />
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {board.hasNextPage && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={board.isFetchingNextPage}
              onClick={() => board.fetchNextPage()}
            >
              {board.isFetchingNextPage
                ? "Loading…"
                : `Show more (${members.length} of ${scopeTotal})`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

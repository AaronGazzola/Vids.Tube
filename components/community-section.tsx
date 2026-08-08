"use client";

import type { CommunityMember } from "@/app/[channelSlug]/page.types";
import {
  useChannelCommunity,
  useCommunityMemberCount,
  useLiveChatters,
} from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { BadgeChip } from "@/components/badge-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { channelAvatarUrl } from "@/lib/storage";
import Link from "next/link";

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

export function CommunitySection({
  channelId,
  channelSlug,
}: {
  channelId: string;
  channelSlug: string;
}) {
  const community = useChannelCommunity(channelId);
  const { data: stream } = useLiveStream(channelId);
  const isLive = stream?.status === "live";
  const liveStreamId = isLive ? stream.id : undefined;
  const { data: chatters } = useLiveChatters(liveStreamId, channelId);
  const { data: polledTotal } = useCommunityMemberCount(channelId, isLive);

  // The polled figure wins while live, so the page and the overlay show the same
  // number; the paged query supplies it otherwise.
  const total = polledTotal ?? community.data?.pages[0]?.total ?? 0;
  const members = community.data?.pages.flatMap((p) => p.members) ?? [];

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Community</h2>
        {community.isPending ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {total.toLocaleString("en-US")}
            </span>{" "}
            {total === 1 ? "member" : "members"}
          </span>
        )}
      </div>

      {!!chatters?.length && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chatting now
          </h3>
          <div className="flex flex-wrap gap-2">
            {chatters.map((member) => (
              <Link
                key={member.channelId}
                href={memberHref(member, channelSlug)}
                className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm hover:bg-muted"
              >
                <MemberAvatar member={member} className="h-6 w-6" />
                {member.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border">
        {community.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : members.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No members yet. Send a message in chat during a broadcast to join.
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
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    lvl {member.level} · {member.lifetimeXp.toLocaleString("en-US")} XP
                  </span>
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

        {community.hasNextPage && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={community.isFetchingNextPage}
              onClick={() => community.fetchNextPage()}
            >
              {community.isFetchingNextPage
                ? "Loading…"
                : `Show more members (${members.length} of ${total})`}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

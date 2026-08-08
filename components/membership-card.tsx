"use client";

import type { ChannelMembership } from "@/app/[channelSlug]/page.types";
import { BadgeChip } from "@/components/badge-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { channelAvatarUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Coins } from "lucide-react";
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

function Stat({
  value,
  label,
  dim,
  icon,
}: {
  value: number;
  label: string;
  dim?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "flex items-center gap-1 text-lg font-semibold tabular-nums tracking-tight",
          dim && "text-muted-foreground"
        )}
      >
        {icon}
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// One shape for every member: someone who joined a minute ago sees the same
// fields in the same places as someone with a thousand messages, carrying zeroes
// rather than a different, smaller card.
export function MembershipCard({
  membership,
  highlighted,
}: {
  membership: ChannelMembership;
  highlighted?: boolean;
}) {
  const avatarUrl = channelAvatarUrl({
    avatar_path: membership.communityAvatarPath,
    remote_avatar_path: membership.communityRemoteAvatarPath,
  });

  return (
    <div
      id={`community-${membership.communitySlug}`}
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-4 transition-colors",
        highlighted && "border-primary/60 ring-2 ring-primary/15"
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={membership.communityName} />
          )}
          <AvatarFallback className="text-xs">
            {initials(membership.communityName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <Link
            href={`/${membership.communitySlug}`}
            className="font-semibold hover:underline"
          >
            {membership.communityName}
          </Link>
        </div>
        {membership.isLive && (
          <span className="inline-flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-destructive">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
            Live
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {membership.rank === null ? "just joined" : `rank ${membership.rank}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat value={membership.level} label="level" dim={membership.level === 0} />
        <Stat
          value={membership.lifetimeXp}
          label="XP"
          dim={membership.lifetimeXp === 0}
        />
        <Stat
          value={membership.credits}
          label="credits"
          dim={membership.credits === 0}
          icon={
            <Coins
              className={cn(
                "h-4 w-4",
                membership.credits === 0
                  ? "text-muted-foreground/50"
                  : "text-amber-500"
              )}
              aria-hidden
            />
          }
        />
        <Stat value={membership.messageCount} label="messages" />
        <Stat value={membership.streamsAttended} label="broadcasts" />
        <Stat
          value={membership.currentStreak}
          label="streak"
          dim={membership.currentStreak === 0}
        />
        <Stat
          value={membership.bestStreak}
          label="best streak"
          dim={membership.bestStreak === 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {membership.badges.map((badge) => (
          <BadgeChip key={badge.key} badge={badge} />
        ))}
        <Link
          href={`/${membership.communitySlug}`}
          className="ml-auto text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          View the community
        </Link>
      </div>
    </div>
  );
}

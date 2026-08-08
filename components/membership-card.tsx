"use client";

import type { ChannelMembership } from "@/app/[channelSlug]/page.types";
import { BadgeChip } from "@/components/badge-chip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { channelAvatarUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  Coins,
  Flame,
  MessagesSquare,
  Radio,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
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

// Each figure gets its own colour and shape so the row can be read by glancing
// rather than by working through seven labels. A figure of nothing loses its
// colour too: an earned thing and an empty one should not look alike.
function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
  tint: string;
}) {
  const earned = value > 0;
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "flex items-center gap-1.5 text-lg font-semibold tabular-nums tracking-tight",
          !earned && "text-muted-foreground"
        )}
      >
        <Icon
          className={cn("h-4 w-4 shrink-0", earned ? tint : "text-muted-foreground/40")}
          aria-hidden
        />
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// A member with no XP holds no rank, and the slot where the rank goes said
// "just joined" — which was a lie for anyone who had been turning up for a year
// without ever being scored. The slot now reports when the member was first
// seen, and keeps "just joined" for the day they actually arrived.
function standing(rank: number | null, firstSeenAt: string | null): string {
  if (rank !== null) return `rank ${rank}`;
  const first = firstSeenAt ? new Date(firstSeenAt).getTime() : NaN;
  if (!Number.isFinite(first)) return "just joined";
  if (Date.now() - first < 24 * 60 * 60 * 1000) return "just joined";
  return `here since ${new Date(first).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })}`;
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
          {standing(membership.rank, membership.firstSeenAt)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat
          value={membership.level}
          label="level"
          icon={Star}
          tint="text-violet-500"
        />
        <Stat
          value={membership.lifetimeXp}
          label="XP"
          icon={Zap}
          tint="text-emerald-500"
        />
        <Stat
          value={membership.credits}
          label="credits"
          icon={Coins}
          tint="text-amber-500"
        />
        <Stat
          value={membership.messageCount}
          label="messages"
          icon={MessagesSquare}
          tint="text-sky-500"
        />
        {/* Broadcasts the member turned up to, not ones they ran. */}
        <Stat
          value={membership.streamsAttended}
          label="attended"
          icon={Radio}
          tint="text-cyan-500"
        />
        <Stat
          value={membership.currentStreak}
          label="streak"
          icon={Flame}
          tint="text-red-500"
        />
        <Stat
          value={membership.bestStreak}
          label="best streak"
          icon={Flame}
          tint="text-yellow-400"
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

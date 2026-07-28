"use client";

import {
  useChannel,
  useChannelMembershipStats,
  useChannelVideos,
  useUpcomingScheduled,
} from "@/app/[channelSlug]/page.hooks";
import { useIsChannelOwner, useLiveStream } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import type { UnclaimedChannelStats } from "@/app/[channelSlug]/page.actions";
import type { Channel } from "@/app/[channelSlug]/page.types";
import { BrandingUploadDialog } from "@/components/branding-upload-dialog";
import { ChannelClaimHint } from "@/components/channel-claim-hint";
import { LiveFeatureCard } from "@/components/live-feature-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoGrid } from "@/components/video-grid";
import { channelAssetUrl, channelAvatarUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ChannelHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="aspect-[5/1] w-full rounded-xl" />
      <div className="flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-center">
        <Skeleton className="h-24 w-24 rounded-full sm:h-28 sm:w-28" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    </div>
  );
}

function formatSeen(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function UnclaimedProfile({
  channel,
  avatarUrl,
  bannerUrl,
  stats,
  isAuthenticated,
}: {
  channel: Channel;
  avatarUrl: string | null;
  bannerUrl: string | null;
  stats: UnclaimedChannelStats | null;
  isAuthenticated: boolean;
}) {
  return (
    <>
      <div className="relative aspect-[5/1] w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-muted">
        {bannerUrl && (
          <img
            src={bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
      <div className="mt-6 flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-center sm:gap-6">
        <Avatar className="h-24 w-24 border-4 border-background shadow-sm sm:h-28 sm:w-28">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={channel.name} />}
          <AvatarFallback className="text-2xl">
            {getInitials(channel.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {channel.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              @{channel.handle}
            </span>
            <span className="mx-1.5">·</span>
            Unclaimed profile
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-6 rounded-xl border p-5">
        <Stat label="Messages" value={stats?.messageCount ?? 0} />
        <Stat label="Streams" value={stats?.streamsAttended ?? 0} />
        <Stat label="First seen" value={formatSeen(stats?.firstSeenAt ?? null)} />
        <Stat label="Last seen" value={formatSeen(stats?.lastSeenAt ?? null)} />
      </div>
      <div className="mt-8 rounded-xl border border-dashed p-6 text-center">
        <h2 className="text-lg font-semibold tracking-tight">
          This page is already here — and it&apos;s you
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Claim it to merge your YouTube history with your Vids.Tube account and
          make this profile yours.
        </p>
        <Button asChild className="mt-4">
          <Link href={isAuthenticated ? "/account" : "/login"}>
            Claim this profile
          </Link>
        </Button>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tracking-tight">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ChannelView({ slug }: { slug: string }) {
  const { data: channel, isPending } = useChannel(slug);
  const router = useRouter();
  const redirectToSlug = channel?.redirectToSlug ?? null;
  useEffect(() => {
    if (redirectToSlug) {
      router.replace(`/${redirectToSlug}`);
    }
  }, [redirectToSlug, router]);
  const { data: videos } = useChannelVideos(channel?.id);
  const isOwner = useIsChannelOwner(channel);
  const { data: stream } = useLiveStream(channel?.id);
  const { data: upcoming } = useUpcomingScheduled(channel?.id);
  const isLive = stream?.status === "live" && !!stream.hls_path;
  const featured = isLive ? stream : upcoming ?? null;

  const isUnclaimed =
    !!channel && !channel.owner_user_id && !channel.merged_into_channel_id;
  const canView = !!channel;

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: unclaimedStats } = useChannelMembershipStats(
    channel?.id,
    isUnclaimed
  );

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);

  const bannerUrl = channelAssetUrl(channel?.banner_path ?? null);
  const avatarUrl = channelAvatarUrl(channel);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      {isPending ? (
        <ChannelHeaderSkeleton />
      ) : channel && isUnclaimed ? (
        <UnclaimedProfile
          channel={channel}
          avatarUrl={avatarUrl}
          bannerUrl={bannerUrl}
          stats={unclaimedStats ?? null}
          isAuthenticated={isAuthenticated}
        />
      ) : channel && canView ? (
        <>
          <div className="relative aspect-[5/1] w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-muted">
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {isOwner && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setBannerDialogOpen(true)}
                aria-label="Upload banner"
                className="absolute bottom-3 right-3 rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background"
              >
                <Camera className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="mt-6 flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-center sm:gap-6">
            <div className="relative">
              <Avatar
                className={cn(
                  "h-24 w-24 border-4 border-background shadow-sm sm:h-28 sm:w-28",
                  isLive &&
                    "ring-4 ring-destructive ring-offset-2 ring-offset-background"
                )}
              >
                {avatarUrl && (
                  <AvatarImage src={avatarUrl} alt={channel.name} />
                )}
                <AvatarFallback className="text-2xl">
                  {getInitials(channel.name)}
                </AvatarFallback>
              </Avatar>
              {isLive && (
                <Link
                  href={`/${channel.slug}/live`}
                  aria-label={`Watch ${channel.name} live`}
                  className="absolute inset-0 rounded-full"
                />
              )}
              {isOwner && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  onClick={() => setAvatarDialogOpen(true)}
                  aria-label="Upload avatar"
                  className="absolute -bottom-1 -right-1 rounded-full bg-background shadow-sm ring-2 ring-background hover:bg-muted"
                >
                  <Camera className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {channel.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  @{channel.handle}
                </span>
                {videos && (
                  <>
                    <span className="mx-1.5">·</span>
                    {videos.length}{" "}
                    {videos.length === 1 ? "video" : "videos"}
                  </>
                )}
              </p>
              {channel.description && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {channel.description}
                </p>
              )}
            </div>
          </div>
          {isOwner && <ChannelClaimHint />}
          {featured && (
            <div className="mt-8 max-w-xl">
              <LiveFeatureCard
                slug={channel.slug}
                stream={featured}
                isLive={isLive}
              />
            </div>
          )}
          <Separator className="my-8" />
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              Videos
            </h2>
            <VideoGrid channel={channel} />
          </section>
          {isOwner && (
            <>
              <BrandingUploadDialog
                open={bannerDialogOpen}
                onOpenChange={setBannerDialogOpen}
                channelId={channel.id}
                channelSlug={channel.slug}
                kind="banner"
              />
              <BrandingUploadDialog
                open={avatarDialogOpen}
                onOpenChange={setAvatarDialogOpen}
                channelId={channel.id}
                channelSlug={channel.slug}
                kind="avatar"
              />
            </>
          )}
        </>
      ) : (
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">Channel not found</h1>
          <p className="mt-2 text-muted-foreground">
            No channel exists at this address.
          </p>
        </div>
      )}
    </main>
  );
}

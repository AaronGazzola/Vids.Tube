"use client";

import {
  useChannel,
  useChannelHasHosted,
  useChannelVideos,
  useUpcomingScheduled,
} from "@/app/[channelSlug]/page.hooks";
import { useIsChannelOwner, useLiveStream } from "@/app/layout.hooks";
import type { Channel } from "@/app/[channelSlug]/page.types";
import { BrandingUploadDialog } from "@/components/branding-upload-dialog";
import { ChannelClaimHint } from "@/components/channel-claim-hint";
import { ClaimChannelStrip } from "@/components/claim-channel-strip";
import { CommunitySection } from "@/components/community-section";
import { LiveFeatureCard } from "@/components/live-feature-card";
import { MembershipsSection } from "@/components/memberships-section";
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

// One header for claimed and unclaimed channels alike. An unclaimed profile is
// where a greeted chatter lands and is the common case — 144 of 148 members —
// so it is not built as a reduced version of a real page.
function ChannelHeader({
  channel,
  avatarUrl,
  bannerUrl,
  isLive,
  isOwner,
  videoCount,
  onEditBanner,
  onEditAvatar,
}: {
  channel: Channel;
  avatarUrl: string | null;
  bannerUrl: string | null;
  isLive: boolean;
  isOwner: boolean;
  videoCount?: number;
  onEditBanner?: () => void;
  onEditAvatar?: () => void;
}) {
  // Only the owner has a cover image, so a gradient placeholder on every chatter
  // page is a large empty band above their stats. The owner keeps the band even
  // when empty, because the upload control lives inside it.
  const showBanner = !!bannerUrl || (isOwner && !!onEditBanner);

  return (
    <>
      {showBanner && (
        <div className="relative aspect-[5/1] w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-muted">
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {isOwner && onEditBanner && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onEditBanner}
              aria-label="Upload banner"
              className="absolute bottom-3 right-3 rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background"
            >
              <Camera className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      <div
        className={cn(
          "flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-center sm:gap-6",
          showBanner && "mt-6"
        )}
      >
        <div className="relative">
          <Avatar
            className={cn(
              "h-24 w-24 border-4 border-background shadow-sm sm:h-28 sm:w-28",
              isLive &&
                "ring-4 ring-destructive ring-offset-2 ring-offset-background"
            )}
          >
            {avatarUrl && <AvatarImage src={avatarUrl} alt={channel.name} />}
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
          {isOwner && onEditAvatar && (
            <Button
              type="button"
              size="icon-sm"
              variant="secondary"
              onClick={onEditAvatar}
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
            {videoCount !== undefined && (
              <>
                <span className="mx-1.5">·</span>
                {videoCount} {videoCount === 1 ? "video" : "videos"}
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
    </>
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
  const { data: videos, isPending: videosPending } = useChannelVideos(
    channel?.id
  );
  const isOwner = useIsChannelOwner(channel);
  const { data: stream } = useLiveStream(channel?.id);
  const { data: upcoming } = useUpcomingScheduled(channel?.id);
  const { data: hasHosted } = useChannelHasHosted(channel?.id);
  const isLive = stream?.status === "live" && !!stream.hls_path;
  const featured = isLive ? stream : upcoming ?? null;

  const isUnclaimed =
    !!channel && !channel.owner_user_id && !channel.merged_into_channel_id;

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);

  const bannerUrl = channelAssetUrl(channel?.banner_path ?? null);
  const avatarUrl = channelAvatarUrl(channel);

  if (isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <ChannelHeaderSkeleton />
      </main>
    );
  }

  if (!channel) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">Channel not found</h1>
          <p className="mt-2 text-muted-foreground">
            No channel exists at this address.
          </p>
        </div>
      </main>
    );
  }

  // An unclaimed profile carries no videos, no live content and no bio: those
  // belong to whoever eventually claims it. The memberships are theirs already.
  if (isUnclaimed) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <ChannelHeader
          channel={channel}
          avatarUrl={avatarUrl}
          bannerUrl={bannerUrl}
          isLive={false}
          isOwner={false}
        />
        <div className="mt-6">
          <ClaimChannelStrip />
        </div>
        <Separator className="my-8" />
        <MembershipsSection channelId={channel.id} />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      <ChannelHeader
        channel={channel}
        avatarUrl={avatarUrl}
        bannerUrl={bannerUrl}
        isLive={isLive}
        isOwner={isOwner}
        videoCount={videos?.length}
        onEditBanner={() => setBannerDialogOpen(true)}
        onEditAvatar={() => setAvatarDialogOpen(true)}
      />
      {isOwner && <ChannelClaimHint channel={channel} />}
      {featured && (
        <div className="mt-8 max-w-xl">
          <LiveFeatureCard
            slug={channel.slug}
            stream={featured}
            isLive={isLive}
          />
        </div>
      )}

      {hasHosted && (
        <>
          <Separator className="my-8" />
          <CommunitySection channelId={channel.id} channelSlug={channel.slug} />
        </>
      )}

      <Separator className="my-8" />
      <MembershipsSection channelId={channel.id} />

      {/* A channel that has never published shows no Videos section at all, the
          same way an empty Memberships section is absent rather than empty. The
          owner keeps it either way, so they can see where uploads will land. */}
      {(videosPending || isOwner || (videos?.length ?? 0) > 0) && (
        <>
          <Separator className="my-8" />
          <section>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">Videos</h2>
            <VideoGrid channel={channel} />
          </section>
        </>
      )}

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
    </main>
  );
}

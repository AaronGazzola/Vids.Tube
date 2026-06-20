"use client";

import {
  useChannel,
  useChannelVideos,
  useUpcomingScheduled,
} from "@/app/[channelSlug]/page.hooks";
import {
  useIsChannelOwner,
  useLiveStream,
  useOwnerChannel,
} from "@/app/layout.hooks";
import { BrandingUploadDialog } from "@/components/branding-upload-dialog";
import { LiveFeatureCard } from "@/components/live-feature-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoGrid } from "@/components/video-grid";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Camera } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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

export function ChannelView({ slug }: { slug: string }) {
  const { data: channel, isPending } = useChannel(slug);
  const { data: ownerChannel, isPending: ownerPending } = useOwnerChannel();
  const { data: videos } = useChannelVideos(channel?.id);
  const isOwner = useIsChannelOwner(channel);
  const { data: stream } = useLiveStream(channel?.id);
  const { data: upcoming } = useUpcomingScheduled(channel?.id);
  const isLive = stream?.status === "live" && !!stream.hls_path;
  const featured = isLive ? stream : upcoming ?? null;

  const isPlatformOwnerChannel =
    !!channel &&
    !!ownerChannel &&
    channel.owner_user_id === ownerChannel.owner_user_id;
  const canView = isPlatformOwnerChannel || isOwner;

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);

  const bannerUrl = channelAssetUrl(channel?.banner_path ?? null);
  const avatarUrl = channelAssetUrl(channel?.avatar_path ?? null);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      {isPending || ownerPending ? (
        <ChannelHeaderSkeleton />
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

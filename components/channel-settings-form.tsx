"use client";

import {
  useHandleAvailability,
  useMyChannel,
  useUpdateChannel,
} from "@/app/layout.hooks";
import { BrandingUploadDialog } from "@/components/branding-upload-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Channel } from "@/app/layout.types";
import {
  HANDLE_REQUIREMENT,
  isValidHandle,
  normalizeHandle,
} from "@/lib/handle";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Camera, Check, Loader2, X } from "lucide-react";
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

export function ChannelSettingsForm() {
  const { data: channel, isPending } = useMyChannel();

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Channel</CardTitle>
          <CardDescription>Your public channel identity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!channel) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Channel</CardTitle>
          <CardDescription>You don&apos;t have a channel yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <ChannelSettingsFields channel={channel} />;
}

function ChannelSettingsFields({ channel }: { channel: Channel }) {
  const updateChannel = useUpdateChannel();

  const [name, setName] = useState(channel.name);
  const [handle, setHandle] = useState(channel.handle);
  const [description, setDescription] = useState(channel.description);
  const [debouncedHandle, setDebouncedHandle] = useState(channel.handle);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);

  const normalized = normalizeHandle(handle);
  const formatValid = isValidHandle(normalized);
  const handleChanged = normalized !== channel.handle;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHandle(normalized), 350);
    return () => clearTimeout(timer);
  }, [normalized]);

  const availability = useHandleAvailability(
    debouncedHandle,
    handleChanged && formatValid && debouncedHandle === normalized
  );

  const checking =
    handleChanged &&
    formatValid &&
    (availability.isPending || debouncedHandle !== normalized);
  const taken =
    handleChanged && formatValid && availability.data?.available === false;
  const canSave =
    name.trim().length > 0 &&
    formatValid &&
    !taken &&
    !checking &&
    !updateChannel.isPending;

  const bannerUrl = channelAssetUrl(channel.banner_path);
  const avatarUrl = channelAssetUrl(channel.avatar_path);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    updateChannel.mutate({
      channelId: channel.id,
      name: name.trim(),
      handle: normalized,
      description,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel</CardTitle>
        <CardDescription>Your public channel identity.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Banner &amp; avatar</Label>
            <div className="relative aspect-[5/1] w-full overflow-hidden rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-muted">
              {bannerUrl && (
                <img
                  src={bannerUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
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
            </div>
            <div className="relative -mt-10 ml-4 w-fit">
              <Avatar className="h-20 w-20 border-4 border-background shadow-sm">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={channel.name} />}
                <AvatarFallback className="text-xl">
                  {getInitials(name || channel.name)}
                </AvatarFallback>
              </Avatar>
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
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-handle">Handle</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                @
              </span>
              <Input
                id="channel-handle"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className="pl-7"
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
              />
            </div>
            {handle.length > 0 && !formatValid && (
              <p className="text-sm text-destructive">{HANDLE_REQUIREMENT}</p>
            )}
            {checking && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking availability…
              </p>
            )}
            {!checking && handleChanged && formatValid && availability.data && (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  availability.data.available
                    ? "text-emerald-600"
                    : "text-destructive"
                )}
              >
                {availability.data.available ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                {availability.data.available
                  ? `@${normalized} is available`
                  : `@${normalized} is taken`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">Description</Label>
            <Textarea
              id="channel-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!canSave}>
            {updateChannel.isPending ? "Saving…" : "Save"}
          </Button>
        </CardFooter>
      </form>

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
    </Card>
  );
}

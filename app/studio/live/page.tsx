"use client";

import { CustomToast } from "@/components/CustomToast";
import { LivePlayer } from "@/components/live-player";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { vodAssetUrl } from "@/lib/storage";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useCurrentBroadcast,
  useEndStream,
  useGoLive,
  useRegenerateStreamKey,
  useStreamKey,
  useUploadBroadcastThumbnail,
} from "./page.hooks";

const STREAM_HOST = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";

function ConnectionDetails() {
  const { data, isPending } = useStreamKey();
  const regenerate = useRegenerateStreamKey();
  const [revealed, setRevealed] = useState(false);

  const rtmpHost = STREAM_HOST.replace(/^https?:\/\//, "") || "stream.vids.tube";
  const rtmpUrl = `rtmp://${rtmpHost}:1935`;
  const key = data?.key ?? "";
  const channelSlug = data?.channelSlug ?? "";
  const obsKey = key ? `${channelSlug}?key=${key}` : "";
  const keyValue = obsKey
    ? revealed
      ? obsKey
      : `${channelSlug}?key=${"•".repeat(20)}`
    : "";

  const copyKey = async () => {
    if (!obsKey) {
      return;
    }
    await navigator.clipboard.writeText(obsKey);
    toast.custom(() => (
      <CustomToast
        variant="success"
        title="Stream key copied"
        message="Paste it into OBS."
      />
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stream setup</CardTitle>
        <CardDescription>
          In OBS, set Service to Custom, paste the Server and Stream Key below,
          then start streaming. When your encoder connects you&apos;ll get a
          private preview here before going live. Wide (16:9) and mobile (9:16)
          formats both work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ingest">Server (RTMP URL)</Label>
          <Input id="ingest" readOnly value={rtmpUrl} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="key">Stream key</Label>
          {isPending ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <div className="flex gap-2">
              <Input id="key" readOnly value={keyValue} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setRevealed((value) => !value)}
                aria-label={revealed ? "Hide stream key" : "Show stream key"}
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyKey}
                aria-label="Copy stream key"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={regenerate.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate key
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate stream key?</AlertDialogTitle>
              <AlertDialogDescription>
                The current key will stop working immediately. You will need to
                update OBS with the new key before streaming again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => regenerate.mutate()}>
                Regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function PreviewSetup({
  hlsPath,
  initialTitle,
  initialDescription,
  thumbnailPath,
}: {
  hlsPath: string | null;
  initialTitle: string;
  initialDescription: string;
  thumbnailPath: string | null;
}) {
  const goLive = useGoLive();
  const uploadThumbnail = useUploadBroadcastThumbnail();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const thumbnailUrl = vodAssetUrl(thumbnailPath);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-2">
        <Badge variant="secondary">Preview — only you can see this</Badge>
        {hlsPath ? (
          <LivePlayer src={hlsPath} />
        ) : (
          <Skeleton className="aspect-video w-full rounded-lg" />
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Set up your broadcast</CardTitle>
          <CardDescription>
            Add a title (and optionally a description and thumbnail), then go
            live when you&apos;re ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What's this stream about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thumbnail">Thumbnail</Label>
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt="Broadcast thumbnail"
                className="aspect-video w-full rounded-md object-cover"
              />
            )}
            <Input
              id="thumbnail"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploadThumbnail.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  uploadThumbnail.mutate(file);
                }
              }}
            />
          </div>
          <Button
            type="button"
            className="w-full"
            disabled={!title.trim() || goLive.isPending}
            onClick={() => goLive.mutate({ title, description })}
          >
            Go live
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function LiveManage() {
  const endStream = useEndStream();

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re live</CardTitle>
        <CardDescription>
          Your broadcast is public on your channel page. End it here or by
          stopping your encoder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={endStream.isPending}>
              End broadcast
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End the broadcast?</AlertDialogTitle>
              <AlertDialogDescription>
                Viewers will stop seeing the live stream and a VOD will be
                created from the recording.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => endStream.mutate()}>
                End broadcast
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default function StudioLivePage() {
  const { data: broadcast, isPending } = useCurrentBroadcast();

  const status = broadcast?.status;
  const isPreview = status === "preview";
  const isLive = status === "live";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Go Live</h1>
        <Badge
          variant={isLive ? "default" : isPreview ? "secondary" : "outline"}
        >
          {isLive ? "Live" : isPreview ? "Preview" : "Offline"}
        </Badge>
      </div>

      {isPending ? (
        <Skeleton className="aspect-video w-full rounded-lg" />
      ) : isPreview ? (
        <PreviewSetup
          hlsPath={broadcast?.hls_path ?? null}
          initialTitle={broadcast?.title ?? ""}
          initialDescription={broadcast?.description ?? ""}
          thumbnailPath={broadcast?.thumbnail_path ?? null}
        />
      ) : isLive ? (
        <LiveManage />
      ) : (
        <ConnectionDetails />
      )}
    </div>
  );
}

"use client";

import { useLiveStream } from "@/app/layout.hooks";
import { CustomToast } from "@/components/CustomToast";
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
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRegenerateStreamKey, useStreamKey } from "./page.hooks";

const STREAM_HOST = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";

export default function StudioLivePage() {
  const { data, isPending } = useStreamKey();
  const regenerate = useRegenerateStreamKey();
  const { data: stream } = useLiveStream(data?.channelId);
  const [revealed, setRevealed] = useState(false);

  const isLive = stream?.status === "live";
  const rtmpHost = STREAM_HOST.replace(/^https?:\/\//, "") || "stream.vids.tube";
  const rtmpUrl = `rtmp://${rtmpHost}/${data?.channelSlug ?? ""}`;
  const key = data?.key ?? "";
  const keyValue = revealed ? key : key ? "•".repeat(24) : "";

  const copyKey = async () => {
    if (!key) {
      return;
    }
    await navigator.clipboard.writeText(key);
    toast.custom(() => (
      <CustomToast
        variant="success"
        title="Stream key copied"
        message="Paste it into OBS."
      />
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Go Live</h1>
        <Badge variant={isLive ? "default" : "secondary"}>
          {isLive ? "Live" : "Offline"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stream setup</CardTitle>
          <CardDescription>
            Point OBS at this server and stream key, then start streaming.
            Configure OBS for a 720p output.
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
    </div>
  );
}

"use client";

import { useRequireOwner } from "@/app/layout.hooks";
import { AuthorChip } from "@/components/author-chip";
import { CustomToast } from "@/components/CustomToast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  useOverlayContext,
  useSetScoringEnabled,
  useViewerLeaderboard,
} from "./page.hooks";

export default function StudioOverlayPage() {
  useRequireOwner();

  const { data: context, isPending } = useOverlayContext();
  const setEnabled = useSetScoringEnabled();
  const streamId = context?.streamId ?? null;
  const { data: leaderboard } = useViewerLeaderboard(streamId);

  const obsUrl =
    context?.channelSlug && typeof window !== "undefined"
      ? `${window.location.origin}/overlay/${context.channelSlug}`
      : "";

  const copyUrl = async () => {
    if (!obsUrl) return;
    await navigator.clipboard.writeText(obsUrl);
    toast.custom(() => (
      <CustomToast
        variant="success"
        title="Copied"
        message="OBS Browser Source URL copied to clipboard."
      />
    ));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Chat overlay</h1>

      <Card>
        <CardHeader>
          <CardTitle>Featuring</CardTitle>
          <CardDescription>
            When on, the scoring bot features the best chat messages and the
            overlay animates each author&apos;s avatar across your stream.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {isPending ? (
            <Skeleton className="h-10 w-40" />
          ) : !streamId ? (
            <p className="text-sm text-muted-foreground">
              No broadcast yet — start your encoder to enable featuring.
            </p>
          ) : (
            <>
              <Button
                onClick={() =>
                  setEnabled.mutate({ streamId, enabled: !context?.enabled })
                }
                disabled={setEnabled.isPending}
                variant={context?.enabled ? "destructive" : "default"}
              >
                {context?.enabled ? "Turn featuring off" : "Turn featuring on"}
              </Button>
              <span className="text-sm text-muted-foreground">
                Currently {context?.enabled ? "on" : "off"}
                {context?.streamStatus
                  ? ` · broadcast ${context.streamStatus}`
                  : ""}
              </span>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OBS Browser Source</CardTitle>
          <CardDescription>
            Add this URL as a Browser Source in OBS over your video. It is
            transparent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          {isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <Input readOnly value={obsUrl} aria-label="Overlay URL" />
              <Button
                variant="outline"
                size="icon"
                onClick={copyUrl}
                aria-label="Copy overlay URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>
            Top viewers by times featured in the current broadcast.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!streamId ? (
            <p className="text-sm text-muted-foreground">
              No broadcast yet.
            </p>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No featured viewers yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((viewer, i) => (
                <li
                  key={viewer.user_id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    <AuthorChip author={viewer.author} size="comment" />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {viewer.features_count}{" "}
                    {viewer.features_count === 1 ? "ring" : "rings"} ·{" "}
                    {viewer.total_score} pts
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

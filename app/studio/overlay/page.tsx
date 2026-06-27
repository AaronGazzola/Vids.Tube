"use client";

import { useRequireOwner } from "@/app/layout.hooks";
import { CustomToast } from "@/components/CustomToast";
import { FeaturedAuthorChip } from "@/components/featured-author-chip";
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
import { useState } from "react";
import { toast } from "sonner";
import {
  useOverlayContext,
  useSetGoals,
  useSetScoringEnabled,
  useSetStreamYoutubeVideo,
  useStartGoals,
  useViewerLeaderboard,
} from "./page.hooks";

export default function StudioOverlayPage() {
  useRequireOwner();

  const { data: context, isPending } = useOverlayContext();
  const setEnabled = useSetScoringEnabled();
  const setYoutube = useSetStreamYoutubeVideo();
  const setGoals = useSetGoals();
  const startGoals = useStartGoals();
  const streamId = context?.streamId ?? null;
  const { data: leaderboard } = useViewerLeaderboard(streamId);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [goalInputs, setGoalInputs] = useState<{
    subs: string;
    likes: string;
    viewers: string;
  } | null>(null);

  const goals = goalInputs ?? {
    subs: String(context?.goals?.subs ?? 1000),
    likes: String(context?.goals?.likes ?? 500),
    viewers: String(context?.goals?.viewers ?? 100),
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const obsUrl = context?.channelSlug
    ? `${origin}/overlay/${context.channelSlug}`
    : "";
  const goalsObsUrl = context?.channelSlug
    ? `${origin}/overlay/${context.channelSlug}/goals`
    : "";
  const competitionObsUrl = context?.channelSlug
    ? `${origin}/overlay/${context.channelSlug}/competition`
    : "";

  const copy = async (url: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
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
          <CardTitle>YouTube broadcast</CardTitle>
          <CardDescription>
            Point this stream at the YouTube video you&apos;re simulcasting. The
            scoring bot reads its live chat and the goal overlays read its
            likes/subs/viewers. The broadcast must be public.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : !streamId ? (
            <p className="text-sm text-muted-foreground">
              No broadcast yet — start your encoder first.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder={
                    context?.youtubeVideoId
                      ? `Current: ${context.youtubeVideoId}`
                      : "YouTube video URL or id"
                  }
                  aria-label="YouTube video URL"
                />
                <Button
                  onClick={() =>
                    setYoutube.mutate({ streamId, urlOrId: youtubeUrl })
                  }
                  disabled={setYoutube.isPending || !youtubeUrl.trim()}
                >
                  Save
                </Button>
                {context?.youtubeVideoId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setYoutubeUrl("");
                      setYoutube.mutate({ streamId, urlOrId: "" });
                    }}
                    disabled={setYoutube.isPending}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {context?.youtubeVideoId && (
                <p className="text-sm text-muted-foreground">
                  Linked to YouTube video{" "}
                  <span className="font-mono">{context.youtubeVideoId}</span>
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
          <CardTitle>Goals (likes / subs / viewers)</CardTitle>
          <CardDescription>
            Targets for the goal overlay. Subs and likes count up from the
            moment you press Start; viewers shows the live count. Needs the
            YouTube video set above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : !streamId ? (
            <p className="text-sm text-muted-foreground">No broadcast yet.</p>
          ) : !context?.youtubeVideoId ? (
            <p className="text-sm text-muted-foreground">
              Set the YouTube video above first.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(["subs", "likes", "viewers"] as const).map((m) => (
                  <label key={m} className="flex flex-col gap-1 text-sm">
                    <span className="capitalize text-muted-foreground">{m}</span>
                    <Input
                      type="number"
                      min={0}
                      value={goals[m]}
                      onChange={(e) =>
                        setGoalInputs({ ...goals, [m]: e.target.value })
                      }
                      aria-label={`${m} goal`}
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() =>
                    setGoals.mutate({
                      streamId,
                      targets: {
                        subs: Number(goals.subs) || 0,
                        likes: Number(goals.likes) || 0,
                        viewers: Number(goals.viewers) || 0,
                      },
                    })
                  }
                  disabled={setGoals.isPending}
                >
                  Save targets
                </Button>
                <Button
                  variant="outline"
                  onClick={() => startGoals.mutate({ streamId })}
                  disabled={startGoals.isPending}
                >
                  {context?.goalsStarted ? "Restart from now" : "Start"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {context?.goalsStarted ? "Tracking" : "Not started"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={goalsObsUrl} aria-label="Goals overlay URL" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copy(goalsObsUrl)}
                  aria-label="Copy goals overlay URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OBS Browser Sources</CardTitle>
          <CardDescription>
            Add these as transparent Browser Sources in OBS over your video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            [
              { label: "Highlights", url: obsUrl },
              { label: "Goals", url: goalsObsUrl },
              { label: "Competition", url: competitionObsUrl },
            ].map(({ label, url }) => (
              <div key={label} className="space-y-1">
                <span className="text-sm font-medium">{label}</span>
                <div className="flex items-center gap-2">
                  <Input readOnly value={url} aria-label={`${label} overlay URL`} />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copy(url)}
                    aria-label={`Copy ${label} overlay URL`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
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
                  key={viewer.participant_key}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    <FeaturedAuthorChip author={viewer.author} />
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

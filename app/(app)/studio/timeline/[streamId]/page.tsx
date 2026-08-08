"use client";

import { useStreamTimeline } from "@/app/(app)/studio/timeline/[streamId]/page.hooks";
import { useTimelineViewStore } from "@/app/(app)/studio/timeline/[streamId]/page.stores";
import type { ScoreCriterion } from "@/app/(app)/studio/timeline/[streamId]/page.types";
import {
  TimelineLanes,
  type TimelineSelection,
} from "@/components/timeline-lanes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer, type SeekRequest } from "@/components/video-player";
import type { FusedSpan } from "@/lib/fused-timeline";
import type {
  StreamMomentRow,
  ThreadWithSpans,
  TimelineScores,
} from "@/lib/timeline.types";
import { cn } from "@/lib/utils";
import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const CRITERIA: ScoreCriterion[] = ["humour", "interest", "engagement"];

function readScores(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) {
    return { humour: 0, interest: 0, engagement: 0 };
  }
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value as TimelineScores)) {
    if (typeof entry === "number") {
      out[key] = entry;
    }
  }
  return out;
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

function ScoreBadges({
  scores,
  active,
}: {
  scores: Record<string, number>;
  active: string;
}) {
  return (
    <>
      {CRITERIA.map((criterion) => (
        <Badge
          key={criterion}
          variant={criterion === active ? "default" : "outline"}
        >
          {criterion} {scores[criterion] ?? 0}
        </Badge>
      ))}
    </>
  );
}

export default function StudioTimelinePage() {
  const params = useParams<{ streamId: string }>();
  const streamId = params.streamId;
  const { data, isPending, error } = useStreamTimeline(streamId);
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);
  const [playingThread, setPlayingThread] = useState<ThreadWithSpans | null>(
    null
  );

  const sortBy = useTimelineViewStore((s) => s.sortBy);
  const minScore = useTimelineViewStore((s) => s.minScore);
  const order = useTimelineViewStore((s) => s.order);
  const setSortBy = useTimelineViewStore((s) => s.setSortBy);
  const setMinScore = useTimelineViewStore((s) => s.setMinScore);
  const setOrder = useTimelineViewStore((s) => s.setOrder);

  const threads = useMemo(() => {
    const all = data?.threads ?? [];
    const kept = all.filter(
      (thread) => (readScores(thread.scores)[sortBy] ?? 0) >= minScore
    );
    const ranked = [...kept].sort((a, b) =>
      order === "time"
        ? a.spans[0].start_s - b.spans[0].start_s
        : (readScores(b.scores)[sortBy] ?? 0) - (readScores(a.scores)[sortBy] ?? 0)
    );
    return { all, kept, ranked };
  }, [data, sortBy, minScore, order]);

  const moments = useMemo(() => {
    const all = data?.moments ?? [];
    const kept = all.filter(
      (moment) => (readScores(moment.scores)[sortBy] ?? 0) >= minScore
    );
    const ranked = [...kept].sort((a, b) =>
      order === "time"
        ? a.start_s - b.start_s
        : (readScores(b.scores)[sortBy] ?? 0) - (readScores(a.scores)[sortBy] ?? 0)
    );
    return { all, kept, ranked };
  }, [data, sortBy, minScore, order]);

  const hidden =
    threads.all.length -
    threads.kept.length +
    (moments.all.length - moments.kept.length);

  const fusedSpans: FusedSpan[] | null = useMemo(() => {
    if (!playingThread) {
      return null;
    }
    return playingThread.spans.map((span) => ({
      startS: span.start_s,
      endS: span.end_s,
    }));
  }, [playingThread]);

  // The id only has to differ from the last one, so that clicking the same entry
  // twice seeks twice. A counter says that; a clock only implies it.
  const seekIdRef = useRef(0);
  const seekTo = (seconds: number) => {
    const duration = data?.vod.durationS ?? 0;
    seekIdRef.current += 1;
    setSeekRequest({
      seconds: duration > 0 ? Math.min(seconds, duration) : seconds,
      id: seekIdRef.current,
    });
  };

  const handleSelect = (selection: TimelineSelection) => {
    if (selection.type === "thread") {
      setPlayingThread(selection.row);
      return;
    }
    setPlayingThread(null);
    seekTo(selection.row.start_s);
  };

  const leaveThread = () => {
    setPlayingThread(null);
  };

  const selectMoment = (moment: StreamMomentRow) => {
    setPlayingThread(null);
    seekTo(moment.start_s);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/studio">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Streams
          </Link>
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          {error.message}
        </p>
      ) : !data ? null : (
        <>
          <div>
            <h2 className="text-lg font-medium">{data.title}</h2>
            <p className="text-sm text-muted-foreground">
              {data.threads.length} threads ·{" "}
              {data.threads.reduce((n, t) => n + t.spans.length, 0)} spans ·{" "}
              {data.moments.length} moments · {data.chapters.length} chapters
            </p>
            {/* The ground the tags are figured against, so a tag that merely
                restates it is visibly wrong while reviewing. */}
            {data.background && (
              <p className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <span className="font-medium">Mostly: </span>
                <span className="text-muted-foreground">{data.background}</span>
              </p>
            )}
          </div>

          {playingThread && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
              <span className="font-medium">
                Playing “{playingThread.title}”
              </span>
              <span className="text-muted-foreground">
                {playingThread.spans.length} span
                {playingThread.spans.length === 1 ? "" : "s"} fused, gaps cut
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={leaveThread}
                className="ml-auto"
              >
                <X className="mr-1 h-4 w-4" />
                Whole stream
              </Button>
            </div>
          )}

          {data.vod.src ? (
            <VideoPlayer
              source={{
                kind: "mp4",
                src: data.vod.src,
                poster: data.vod.poster ?? undefined,
              }}
              width={data.vod.width}
              height={data.vod.height}
              seekRequest={seekRequest}
              spans={fusedSpans}
            />
          ) : (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              This stream has no playable VOD, so entries cannot be reviewed
              against the video.
            </p>
          )}

          {data.threads.length === 0 && data.moments.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              This stream has not been labelled yet. Run{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                npm run backfill:timeline -- --stream {data.streamId}
              </code>{" "}
              to label it.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-1">
                  {CRITERIA.map((criterion) => (
                    <Button
                      key={criterion}
                      size="sm"
                      variant={sortBy === criterion ? "default" : "outline"}
                      onClick={() => setSortBy(criterion)}
                    >
                      {criterion}
                    </Button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  min {minScore}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                  />
                </label>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={order === "score" ? "secondary" : "ghost"}
                    onClick={() => setOrder("score")}
                  >
                    by score
                  </Button>
                  <Button
                    size="sm"
                    variant={order === "time" ? "secondary" : "ghost"}
                    onClick={() => setOrder("time")}
                  >
                    in time order
                  </Button>
                </div>

                {hidden > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {hidden} hidden by the score filter
                  </span>
                )}
              </div>

              <TimelineLanes
                threads={threads.kept}
                moments={moments.kept}
                chapters={data.chapters}
                durationS={data.vod.durationS}
                criterion={sortBy}
                selectedThreadId={playingThread?.id ?? null}
                onSelect={handleSelect}
              />

              <ul className="space-y-2">
                {threads.ranked.map((thread) => {
                  const scores = readScores(thread.scores);
                  return (
                    <li key={thread.id}>
                      <div
                        className={cn(
                          "rounded-lg border p-3",
                          playingThread?.id === thread.id && "border-primary"
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setPlayingThread(thread)}
                            className="truncate text-left text-sm font-medium hover:underline"
                          >
                            {thread.title}
                          </button>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {thread.spans.length} span
                            {thread.spans.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {thread.summary && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {thread.summary}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <ScoreBadges scores={scores} active={sortBy} />
                          {thread.tags.map((value) => (
                            <Badge key={value} variant="secondary">
                              {value}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {thread.spans.map((span) => (
                            <button
                              key={span.id}
                              type="button"
                              onClick={() => {
                                setPlayingThread(null);
                                seekTo(span.start_s);
                              }}
                              className="rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
                            >
                              {formatClock(span.start_s)}–
                              {formatClock(span.end_s)} {span.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}

                {moments.ranked.map((moment) => {
                  const scores = readScores(moment.scores);
                  return (
                    <li key={moment.id}>
                      <button
                        type="button"
                        onClick={() => selectMoment(moment)}
                        className="w-full rounded-lg border border-amber-500/40 p-3 text-left transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-sm font-medium">
                            {moment.kind}: {moment.label}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatClock(moment.start_s)}–
                            {formatClock(moment.end_s)}
                          </span>
                        </div>
                        {moment.summary && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {moment.summary}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <ScoreBadges scores={scores} active={sortBy} />
                          {moment.tags.map((value) => (
                            <Badge key={value} variant="secondary">
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

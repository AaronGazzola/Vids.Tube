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
import type { StreamMomentRow, StreamSectionRow } from "@/lib/timeline.types";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

const CRITERIA: ScoreCriterion[] = ["humour", "interest", "engagement"];

type RankedEntry = {
  id: string;
  kind: "section" | "moment";
  label: string;
  summary: string;
  tags: string[];
  startS: number;
  endS: number | null;
  scores: Record<string, number>;
  selection: TimelineSelection;
};

function readScores(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null) {
    return { humour: 0, interest: 0, engagement: 0 };
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
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

function toRanked(
  sections: StreamSectionRow[],
  moments: StreamMomentRow[]
): RankedEntry[] {
  const fromSections: RankedEntry[] = sections.map((row) => ({
    id: row.id,
    kind: "section",
    label: row.label,
    summary: row.summary,
    tags: row.tags,
    startS: row.start_s,
    endS: row.end_s,
    scores: readScores(row.scores),
    selection: { type: "section", row },
  }));
  const fromMoments: RankedEntry[] = moments.map((row) => ({
    id: row.id,
    kind: "moment",
    label: `${row.kind}: ${row.label}`,
    summary: row.summary,
    tags: row.tags,
    startS: row.start_s,
    endS: row.end_s,
    scores: readScores(row.scores),
    selection: { type: "moment", row },
  }));
  return [...fromSections, ...fromMoments];
}

export default function StudioTimelinePage() {
  const params = useParams<{ streamId: string }>();
  const streamId = params.streamId;
  const { data, isPending, error } = useStreamTimeline(streamId);
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null);

  const sortBy = useTimelineViewStore((s) => s.sortBy);
  const minScore = useTimelineViewStore((s) => s.minScore);
  const tag = useTimelineViewStore((s) => s.tag);
  const setSortBy = useTimelineViewStore((s) => s.setSortBy);
  const setMinScore = useTimelineViewStore((s) => s.setMinScore);
  const setTag = useTimelineViewStore((s) => s.setTag);

  const allTags = useMemo(() => {
    if (!data) {
      return [];
    }
    const tags = new Set<string>();
    for (const row of [...data.sections, ...data.moments]) {
      for (const value of row.tags) {
        tags.add(value);
      }
    }
    return [...tags].sort();
  }, [data]);

  const ranked = useMemo(() => {
    if (!data) {
      return [];
    }
    return toRanked(data.sections, data.moments)
      .filter((entry) => (entry.scores[sortBy] ?? 0) >= minScore)
      .filter((entry) => (tag ? entry.tags.includes(tag) : true))
      .sort((a, b) => (b.scores[sortBy] ?? 0) - (a.scores[sortBy] ?? 0));
  }, [data, sortBy, minScore, tag]);

  const visible = useMemo(() => {
    const keep = new Set(ranked.map((entry) => entry.id));
    return {
      sections: (data?.sections ?? []).filter((row) => keep.has(row.id)),
      moments: (data?.moments ?? []).filter((row) => keep.has(row.id)),
    };
  }, [data, ranked]);

  const handleSelect = (selection: TimelineSelection) => {
    const seconds =
      selection.type === "chapter"
        ? selection.row.start_s
        : selection.row.start_s;
    const duration = data?.vod.durationS ?? 0;
    setSeekRequest({
      seconds: duration > 0 ? Math.min(seconds, duration) : seconds,
      id: Date.now(),
    });
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
              {data.sections.length} sections · {data.moments.length} moments ·{" "}
              {data.chapters.length} chapters
            </p>
          </div>

          {data.vod.src ? (
            <VideoPlayer
              src={data.vod.src}
              poster={data.vod.poster ?? undefined}
              width={data.vod.width}
              height={data.vod.height}
              seekRequest={seekRequest}
            />
          ) : (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              This stream has no playable VOD, so entries cannot be reviewed
              against the video.
            </p>
          )}

          {data.sections.length === 0 && data.moments.length === 0 ? (
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

                {allTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      size="sm"
                      variant={tag === null ? "secondary" : "ghost"}
                      onClick={() => setTag(null)}
                    >
                      all tags
                    </Button>
                    {allTags.map((value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={tag === value ? "secondary" : "ghost"}
                        onClick={() => setTag(tag === value ? null : value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <TimelineLanes
                sections={visible.sections}
                moments={visible.moments}
                chapters={data.chapters}
                durationS={data.vod.durationS}
                onSelect={handleSelect}
              />

              <ul className="space-y-2">
                {ranked.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(entry.selection)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {entry.label}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatClock(entry.startS)}
                          {entry.endS !== null && entry.endS !== entry.startS
                            ? ` – ${formatClock(entry.endS)}`
                            : ""}
                        </span>
                      </div>
                      {entry.summary && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.summary}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {CRITERIA.map((criterion) => (
                          <Badge
                            key={criterion}
                            variant={criterion === sortBy ? "default" : "outline"}
                          >
                            {criterion} {entry.scores[criterion] ?? 0}
                          </Badge>
                        ))}
                        {entry.tags.map((value) => (
                          <Badge key={value} variant="secondary">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

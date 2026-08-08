"use client";

import {
  laneCount,
  packThreadLanes,
  uncoveredStretches,
} from "@/lib/timeline-lanes";
import type {
  StreamChapterRow,
  StreamMomentRow,
  StreamThreadSpanRow,
  ThreadWithSpans,
  TimelineScores,
} from "@/lib/timeline.types";
import { cn } from "@/lib/utils";

export type TimelineSelection =
  // The span carries which appearance was clicked, so playback lands on that
  // part of the thread rather than always at its beginning.
  | { type: "thread"; row: ThreadWithSpans; span: StreamThreadSpanRow }
  | { type: "moment"; row: StreamMomentRow }
  | { type: "chapter"; row: StreamChapterRow };

const LANE_HEIGHT_PX = 30;
const MOMENT_ROW_PX = 26;
const MIN_WIDTH_PX = 1100;
const TICK_INTERVAL_S = 300;

function asScores(value: unknown): TimelineScores | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.humour !== "number" ||
    typeof record.interest !== "number" ||
    typeof record.engagement !== "number"
  ) {
    return null;
  }
  return record as TimelineScores;
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function scoreOf(value: unknown, criterion: string): number {
  return asScores(value)?.[criterion] ?? 0;
}

export function TimelineLanes({
  threads,
  moments,
  chapters,
  durationS,
  criterion,
  selectedThreadId,
  selectedMomentId,
  onSelect,
  className,
}: {
  threads: ThreadWithSpans[];
  moments: StreamMomentRow[];
  chapters: StreamChapterRow[];
  durationS: number;
  criterion: string;
  selectedThreadId: string | null;
  selectedMomentId: string | null;
  onSelect: (selection: TimelineSelection) => void;
  className?: string;
}) {
  if (durationS <= 0) {
    return null;
  }

  const packed = packThreadLanes(threads, (thread) =>
    scoreOf(thread.scores, criterion)
  );
  const lanes = laneCount(packed);
  const pct = (seconds: number) => (seconds / durationS) * 100;

  const gaps = uncoveredStretches(
    threads.flatMap((thread) => thread.spans),
    durationS
  );

  const ticks: number[] = [];
  for (let t = TICK_INTERVAL_S; t < durationS; t += TICK_INTERVAL_S) {
    ticks.push(t);
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="space-y-1" style={{ minWidth: `${MIN_WIDTH_PX}px` }}>
        {chapters.length > 0 && (
          <div className="relative h-6 rounded-md bg-muted/30">
            {chapters.map((chapter, index) => {
              const next = chapters[index + 1];
              const endS = next ? next.start_s : durationS;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onSelect({ type: "chapter", row: chapter })}
                  title={`${chapter.title}\n${formatClock(chapter.start_s)}`}
                  className="absolute top-0 h-6 overflow-hidden border-r border-background px-1.5 text-left text-[11px] leading-6 text-muted-foreground hover:bg-muted/60"
                  style={{
                    left: `${pct(chapter.start_s)}%`,
                    width: `${Math.max(0.5, pct(endS - chapter.start_s))}%`,
                  }}
                >
                  <span className="truncate">{chapter.title}</span>
                </button>
              );
            })}
          </div>
        )}

        <div
          className="relative rounded-md bg-muted/20"
          style={{ height: `${Math.max(1, lanes) * LANE_HEIGHT_PX}px` }}
        >
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className="absolute inset-y-0 w-px bg-border/60"
              style={{ left: `${pct(t)}%` }}
            />
          ))}
          {packed.map(({ thread, lane }) => {
            const selected = thread.id === selectedThreadId;
            const score = scoreOf(thread.scores, criterion);
            return thread.spans.map((span, index) => (
              <button
                key={span.id}
                type="button"
                data-thread-id={thread.id}
                onClick={() => onSelect({ type: "thread", row: thread, span })}
                title={`${thread.title}\n${thread.summary}\n${thread.tags.join(", ")}`}
                className={cn(
                  "absolute flex items-center gap-1.5 overflow-hidden rounded px-1.5 text-left text-[11px] leading-none transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/60"
                    : "bg-primary/70 text-primary-foreground hover:bg-primary"
                )}
                style={{
                  top: `${lane * LANE_HEIGHT_PX + 3}px`,
                  height: `${LANE_HEIGHT_PX - 6}px`,
                  left: `${pct(span.start_s)}%`,
                  width: `${Math.max(0.6, pct(span.end_s - span.start_s))}%`,
                }}
              >
                <span className="truncate font-medium">
                  {index === 0 ? thread.title : span.label}
                </span>
                <span className="shrink-0 opacity-70">{score}</span>
              </button>
            ));
          })}
          {/* A thread's appearances read as one row, so the stretches between them
              are drawn as the dotted line the subject is absent for. */}
          {packed.map(({ thread, lane }) =>
            thread.spans.slice(0, -1).map((span, index) => {
              const next = thread.spans[index + 1];
              if (next.start_s <= span.end_s) {
                return null;
              }
              return (
                <div
                  key={`${span.id}-link`}
                  aria-hidden
                  className="absolute border-t border-dashed border-primary/40"
                  style={{
                    top: `${lane * LANE_HEIGHT_PX + LANE_HEIGHT_PX / 2}px`,
                    left: `${pct(span.end_s)}%`,
                    width: `${pct(next.start_s - span.end_s)}%`,
                  }}
                />
              );
            })
          )}
        </div>

        <div
          className="relative rounded-md bg-muted/20"
          style={{ height: `${MOMENT_ROW_PX}px` }}
        >
          {moments.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect({ type: "moment", row })}
              title={`${row.kind}: ${row.label}\n${row.summary}`}
              className={cn(
                "absolute top-1 flex h-4.5 items-center overflow-hidden rounded px-1 text-left text-[10px] leading-none text-amber-950",
                row.id === selectedMomentId
                  ? "bg-amber-300 ring-2 ring-amber-600"
                  : "bg-amber-500 hover:bg-amber-400"
              )}
              style={{
                left: `${pct(row.start_s)}%`,
                width: `${Math.max(0.4, pct(row.end_s - row.start_s))}%`,
              }}
            >
              <span className="truncate">{row.label}</span>
              <span
                aria-hidden
                className="absolute inset-y-0 w-px bg-amber-950/70"
                style={{
                  left: `${((row.peak_s - row.start_s) / Math.max(0.001, row.end_s - row.start_s)) * 100}%`,
                }}
              />
            </button>
          ))}
        </div>

        {/* What no thread occupies: the parts of the stream nothing can be made of. */}
        <div className="relative h-2 rounded-md bg-primary/20">
          {gaps.map((gap) => (
            <div
              key={`${gap.start_s}-${gap.end_s}`}
              title={`Nothing labelled ${formatClock(gap.start_s)} – ${formatClock(gap.end_s)}`}
              className="absolute inset-y-0 bg-muted"
              style={{
                left: `${pct(gap.start_s)}%`,
                width: `${Math.max(0.2, pct(gap.end_s - gap.start_s))}%`,
              }}
            />
          ))}
        </div>

        <div className="relative h-4 text-[10px] text-muted-foreground">
          <span className="absolute left-0">0:00</span>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2"
              style={{ left: `${pct(t)}%` }}
            >
              {formatClock(t)}
            </span>
          ))}
          <span className="absolute right-0">{formatClock(durationS)}</span>
        </div>
      </div>
    </div>
  );
}

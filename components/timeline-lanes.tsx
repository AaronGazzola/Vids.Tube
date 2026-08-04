"use client";

import { laneCount, packSectionLanes } from "@/lib/timeline-lanes";
import type {
  StreamChapterRow,
  StreamMomentRow,
  StreamSectionRow,
  TimelineScores,
} from "@/lib/timeline.types";
import { cn } from "@/lib/utils";

export type TimelineSelection =
  | { type: "section"; row: StreamSectionRow }
  | { type: "moment"; row: StreamMomentRow }
  | { type: "chapter"; row: StreamChapterRow };

const LANE_HEIGHT_PX = 34;
const MIN_WIDTH_PX = 720;

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

function scoreLine(scores: TimelineScores | null): string {
  if (!scores) {
    return "";
  }
  return `humour ${scores.humour} · interest ${scores.interest} · engagement ${scores.engagement}`;
}

function entryTitle(
  label: string,
  startS: number,
  endS: number | null,
  summary: string,
  tags: string[],
  scores: TimelineScores | null
): string {
  const span =
    endS === null || endS === startS
      ? formatClock(startS)
      : `${formatClock(startS)} – ${formatClock(endS)}`;
  return [label, span, summary, tags.join(", "), scoreLine(scores)]
    .filter((part) => part && part.length > 0)
    .join("\n");
}

export function TimelineLanes({
  sections,
  moments,
  chapters,
  durationS,
  onSelect,
  className,
}: {
  sections: StreamSectionRow[];
  moments: StreamMomentRow[];
  chapters: StreamChapterRow[];
  durationS: number;
  onSelect: (selection: TimelineSelection) => void;
  className?: string;
}) {
  if (durationS <= 0) {
    return null;
  }

  const packed = packSectionLanes(
    sections.map((row) => ({
      start_s: row.start_s,
      end_s: row.end_s,
      label: row.label,
      summary: row.summary,
      tags: row.tags,
      scores: asScores(row.scores) ?? {
        humour: 0,
        interest: 0,
        engagement: 0,
      },
      row,
    })),
    durationS
  );

  const lanes = laneCount(packed);
  const pct = (seconds: number) => (seconds / durationS) * 100;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="space-y-2" style={{ minWidth: `${MIN_WIDTH_PX}px` }}>
        {chapters.length > 0 && (
          <div className="relative h-7 rounded-md bg-muted/40">
            {chapters.map((chapter, index) => {
              const next = chapters[index + 1];
              const endS = next ? next.start_s : durationS;
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onSelect({ type: "chapter", row: chapter })}
                  title={`${chapter.title}\n${formatClock(chapter.start_s)}`}
                  className="absolute top-0 h-7 overflow-hidden border-r border-background bg-secondary px-2 text-left text-xs leading-7 text-secondary-foreground hover:bg-secondary/70"
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
          {packed.map(({ section, lane }) => {
            const row = section.row;
            const endS = row.end_s ?? durationS;
            const open = row.end_s === null;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelect({ type: "section", row })}
                title={entryTitle(
                  row.label,
                  row.start_s,
                  row.end_s,
                  row.summary,
                  row.tags,
                  asScores(row.scores)
                )}
                className={cn(
                  "absolute overflow-hidden rounded px-2 text-left text-xs leading-6 transition-colors",
                  open
                    ? "border border-dashed border-primary/60 bg-primary/10 text-foreground hover:bg-primary/20"
                    : "bg-primary/70 text-primary-foreground hover:bg-primary"
                )}
                style={{
                  top: `${lane * LANE_HEIGHT_PX + 4}px`,
                  height: `${LANE_HEIGHT_PX - 8}px`,
                  left: `${pct(row.start_s)}%`,
                  width: `${Math.max(0.6, pct(endS - row.start_s))}%`,
                }}
              >
                <span className="truncate">{row.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative h-8 rounded-md bg-muted/20">
          {moments.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect({ type: "moment", row })}
              title={entryTitle(
                `${row.kind}: ${row.label}`,
                row.start_s,
                row.end_s,
                row.summary,
                row.tags,
                asScores(row.scores)
              )}
              className="absolute top-1 h-6 w-2 -translate-x-1/2 rounded-full bg-amber-500 hover:bg-amber-400"
              style={{ left: `${pct(row.start_s)}%` }}
            >
              <span className="sr-only">{row.label}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0:00</span>
          <span>{formatClock(durationS)}</span>
        </div>
      </div>
    </div>
  );
}

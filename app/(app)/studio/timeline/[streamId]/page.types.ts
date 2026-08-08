import type {
  StreamChapterRow,
  StreamMomentRow,
  ThreadWithSpans,
} from "@/lib/timeline.types";

export type TimelineVod = {
  src: string | null;
  durationS: number;
  width: number | null;
  height: number | null;
  poster: string | null;
};

export type TimelineStreamDetail = {
  streamId: string;
  title: string;
  startedAt: string | null;
  vod: TimelineVod;
  threads: ThreadWithSpans[];
  moments: StreamMomentRow[];
  chapters: StreamChapterRow[];
};

export type ScoreCriterion = "humour" | "interest" | "engagement";

export type TimelineOrder = "score" | "time";

import type {
  StreamChapterRow,
  StreamMomentRow,
  StreamSectionRow,
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
  sections: StreamSectionRow[];
  moments: StreamMomentRow[];
  chapters: StreamChapterRow[];
};

export type ScoreCriterion = "humour" | "interest" | "engagement";

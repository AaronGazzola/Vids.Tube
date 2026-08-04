import type { Database } from "@/supabase/types";

export type StreamSectionRow =
  Database["public"]["Tables"]["stream_sections"]["Row"];
export type StreamMomentRow =
  Database["public"]["Tables"]["stream_moments"]["Row"];
export type StreamChapterRow =
  Database["public"]["Tables"]["stream_chapters"]["Row"];

export type TimelineScores = {
  humour: number;
  interest: number;
  engagement: number;
  [criterion: string]: number;
};

export type TimelineSection = {
  start_s: number;
  end_s: number | null;
  label: string;
  summary: string;
  tags: string[];
  scores: TimelineScores;
};

export type TimelineMoment = {
  start_s: number;
  end_s: number;
  kind: string;
  label: string;
  summary: string;
  tags: string[];
  scores: TimelineScores;
};

export type TimelineChapter = {
  start_s: number;
  title: string;
};

export type TimelinePayload = {
  sections: TimelineSection[];
  moments: TimelineMoment[];
  chapters: TimelineChapter[];
};

export type TimelineEntry =
  | ({ type: "section"; id: string } & TimelineSection)
  | ({ type: "moment"; id: string } & TimelineMoment)
  | ({ type: "chapter"; id: string } & TimelineChapter);

export type TranscriptLine = {
  atS: number;
  endS: number;
  text: string;
};

export type ChatLine = {
  atS: number;
  author: string;
  body: string;
};

export type ActivityBucket = {
  atS: number;
  messages: number;
  uniqueAuthors: number;
};

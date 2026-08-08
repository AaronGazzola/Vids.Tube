import type { Database } from "@/supabase/types";

export type StreamThreadRow =
  Database["public"]["Tables"]["stream_threads"]["Row"];
export type StreamThreadSpanRow =
  Database["public"]["Tables"]["stream_thread_spans"]["Row"];
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

// One appearance of a subject. The label says which part of the thread this is —
// "first mention", "the denial" — rather than restating what the subject is.
export type TimelineSpan = {
  start_s: number;
  end_s: number;
  label: string;
  scores: TimelineScores;
};

// A subject. It has no time of its own; its spans locate it.
export type TimelineThread = {
  title: string;
  summary: string;
  tags: string[];
  scores: TimelineScores;
  spans: TimelineSpan[];
};

// start_s/end_s bound a window that stands alone as a clip; peak_s is where the
// thing itself happens. `thread` names the subject it belongs to, or nothing.
export type TimelineMoment = {
  start_s: number;
  peak_s: number;
  end_s: number;
  kind: string;
  label: string;
  summary: string;
  tags: string[];
  scores: TimelineScores;
  thread: string | null;
};

export type TimelineChapter = {
  start_s: number;
  title: string;
};

export type TimelinePayload = {
  // The stream's steady state. Tags name departures from it, so it has to be
  // written down before a tag can be judged.
  background: string;
  threads: TimelineThread[];
  moments: TimelineMoment[];
  chapters: TimelineChapter[];
};

export type ThreadWithSpans = StreamThreadRow & {
  spans: StreamThreadSpanRow[];
};

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

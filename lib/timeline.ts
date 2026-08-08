import type {
  TimelineChapter,
  TimelineMoment,
  TimelinePayload,
  TimelineScores,
  TimelineSpan,
  TimelineThread,
} from "@/lib/timeline.types";

export const SCORE_CRITERIA = ["humour", "interest", "engagement"] as const;

export const PROMPT_VERSION = "timeline-2";

export const CHAPTER_START_EPSILON_S = 1;

export type ValidationFailure = { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateScores(raw: unknown, where: string): TimelineScores | string {
  if (!isRecord(raw)) {
    return `${where}: scores must be an object`;
  }
  const scores: Record<string, number> = {};
  for (const criterion of SCORE_CRITERIA) {
    const value = raw[criterion];
    if (!isFiniteNumber(value)) {
      return `${where}: scores.${criterion} is missing or not a number`;
    }
    if (!Number.isInteger(value)) {
      return `${where}: scores.${criterion} must be an integer, got ${value}`;
    }
    if (value < 0 || value > 100) {
      return `${where}: scores.${criterion} must be between 0 and 100, got ${value}`;
    }
    scores[criterion] = value;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (key in scores) {
      continue;
    }
    if (!isFiniteNumber(value) || !Number.isInteger(value)) {
      return `${where}: extra score ${key} must be an integer`;
    }
    if (value < 0 || value > 100) {
      return `${where}: extra score ${key} must be between 0 and 100`;
    }
    scores[key] = value;
  }
  return scores as TimelineScores;
}

function validateTags(raw: unknown, where: string): string[] | string {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    return `${where}: tags must be an array`;
  }
  const tags: string[] = [];
  for (const tag of raw) {
    if (!nonEmptyString(tag)) {
      return `${where}: every tag must be a non-empty string`;
    }
    tags.push(tag.trim());
  }
  return tags;
}

function validateSpan(
  raw: unknown,
  where: string,
  durationS: number
): TimelineSpan | string {
  if (!isRecord(raw)) {
    return `${where} must be an object`;
  }
  if (!isFiniteNumber(raw.start_s) || raw.start_s < 0) {
    return `${where}: start_s must be a number at or above 0`;
  }
  if (raw.start_s > durationS) {
    return `${where}: start_s ${raw.start_s} is past the stream duration ${durationS}`;
  }
  if (!isFiniteNumber(raw.end_s)) {
    return `${where}: end_s must be a number`;
  }
  if (raw.end_s < raw.start_s) {
    return `${where}: end_s ${raw.end_s} is before start_s ${raw.start_s}`;
  }
  if (raw.end_s > durationS) {
    return `${where}: end_s ${raw.end_s} is past the stream duration ${durationS}`;
  }
  if (!nonEmptyString(raw.label)) {
    return `${where}: label must be a non-empty string`;
  }
  const scores = validateScores(raw.scores, where);
  if (typeof scores === "string") {
    return scores;
  }
  return {
    start_s: raw.start_s,
    end_s: raw.end_s,
    label: raw.label.trim(),
    scores,
  };
}

function normaliseTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function validateTimelinePayload(
  raw: unknown,
  durationS: number
): TimelinePayload | ValidationFailure {
  if (!isRecord(raw)) {
    return { error: "payload must be a JSON object" };
  }

  const expected = ["threads", "moments", "chapters"];
  const keys = Object.keys(raw);
  const missing = expected.filter((key) => !keys.includes(key));
  if (missing.length > 0) {
    return { error: `payload is missing ${missing.join(", ")}` };
  }
  const extra = keys.filter((key) => !expected.includes(key));
  if (extra.length > 0) {
    return { error: `payload has unexpected keys: ${extra.join(", ")}` };
  }
  for (const key of expected) {
    if (!Array.isArray(raw[key])) {
      return { error: `payload.${key} must be an array` };
    }
  }

  const threads: TimelineThread[] = [];
  for (const [index, entry] of (raw.threads as unknown[]).entries()) {
    const where = `threads[${index}]`;
    if (!isRecord(entry)) {
      return { error: `${where} must be an object` };
    }
    if (!nonEmptyString(entry.title)) {
      return { error: `${where}: title must be a non-empty string` };
    }
    if (typeof entry.summary !== "string") {
      return { error: `${where}: summary must be a string` };
    }
    const tags = validateTags(entry.tags, where);
    if (typeof tags === "string") {
      return { error: tags };
    }
    const scores = validateScores(entry.scores, where);
    if (typeof scores === "string") {
      return { error: scores };
    }
    if (!Array.isArray(entry.spans) || entry.spans.length === 0) {
      return { error: `${where}: spans must be a non-empty array` };
    }
    const spans: TimelineSpan[] = [];
    for (const [spanIndex, spanRaw] of entry.spans.entries()) {
      const span = validateSpan(spanRaw, `${where}.spans[${spanIndex}]`, durationS);
      if (typeof span === "string") {
        return { error: span };
      }
      spans.push(span);
    }
    spans.sort((a, b) => a.start_s - b.start_s);
    threads.push({
      title: entry.title.trim(),
      summary: entry.summary.trim(),
      tags,
      scores,
      spans,
    });
  }

  const titles = new Set(threads.map((thread) => normaliseTitle(thread.title)));

  const moments: TimelineMoment[] = [];
  for (const [index, entry] of (raw.moments as unknown[]).entries()) {
    const where = `moments[${index}]`;
    if (!isRecord(entry)) {
      return { error: `${where} must be an object` };
    }
    if (!isFiniteNumber(entry.start_s) || entry.start_s < 0) {
      return { error: `${where}: start_s must be a number at or above 0` };
    }
    if (!isFiniteNumber(entry.end_s)) {
      return { error: `${where}: end_s must be a number` };
    }
    if (entry.end_s <= entry.start_s) {
      return {
        error: `${where}: a moment must be a window a clip can be cut from, but end_s ${entry.end_s} is not after start_s ${entry.start_s}`,
      };
    }
    if (entry.end_s > durationS) {
      return {
        error: `${where}: end_s ${entry.end_s} is past the stream duration ${durationS}`,
      };
    }
    const peakS = entry.peak_s === undefined || entry.peak_s === null ? entry.start_s : entry.peak_s;
    if (!isFiniteNumber(peakS)) {
      return { error: `${where}: peak_s must be a number` };
    }
    if (peakS < entry.start_s || peakS > entry.end_s) {
      return {
        error: `${where}: peak_s ${peakS} falls outside the window ${entry.start_s}-${entry.end_s}`,
      };
    }
    if (!nonEmptyString(entry.kind)) {
      return { error: `${where}: kind must be a non-empty string` };
    }
    if (!nonEmptyString(entry.label)) {
      return { error: `${where}: label must be a non-empty string` };
    }
    if (typeof entry.summary !== "string") {
      return { error: `${where}: summary must be a string` };
    }
    const tags = validateTags(entry.tags, where);
    if (typeof tags === "string") {
      return { error: tags };
    }
    const scores = validateScores(entry.scores, where);
    if (typeof scores === "string") {
      return { error: scores };
    }
    // A dangling thread reference is dropped rather than failing the payload: it is
    // not worth discarding a four-minute call over one unmatched title.
    const referenced =
      nonEmptyString(entry.thread) && titles.has(normaliseTitle(entry.thread))
        ? entry.thread.trim()
        : null;
    moments.push({
      start_s: entry.start_s,
      peak_s: peakS,
      end_s: entry.end_s,
      kind: entry.kind.trim(),
      label: entry.label.trim(),
      summary: entry.summary.trim(),
      tags,
      scores,
      thread: referenced,
    });
  }

  const chapters: TimelineChapter[] = [];
  for (const [index, entry] of (raw.chapters as unknown[]).entries()) {
    const where = `chapters[${index}]`;
    if (!isRecord(entry)) {
      return { error: `${where} must be an object` };
    }
    if (!isFiniteNumber(entry.start_s) || entry.start_s < 0) {
      return { error: `${where}: start_s must be a number at or above 0` };
    }
    if (entry.start_s > durationS) {
      return {
        error: `${where}: start_s ${entry.start_s} is past the stream duration ${durationS}`,
      };
    }
    if (!nonEmptyString(entry.title)) {
      return { error: `${where}: title must be a non-empty string` };
    }
    chapters.push({ start_s: entry.start_s, title: entry.title.trim() });
  }

  if (chapters.length > 0) {
    if (chapters[0].start_s > CHAPTER_START_EPSILON_S) {
      return {
        error: `chapters[0]: the first chapter must start at 0, got ${chapters[0].start_s}`,
      };
    }
    chapters[0].start_s = 0;
    for (let i = 1; i < chapters.length; i += 1) {
      if (chapters[i].start_s <= chapters[i - 1].start_s) {
        return {
          error: `chapters[${i}]: start_s ${chapters[i].start_s} is not after the previous chapter's ${chapters[i - 1].start_s}`,
        };
      }
    }
  }

  return { threads, moments, chapters };
}

function nearestBoundary(
  value: number,
  boundaries: number[],
  toleranceS: number
): number {
  let best = value;
  let bestDistance = toleranceS;
  for (const boundary of boundaries) {
    const distance = Math.abs(boundary - value);
    if (distance <= bestDistance) {
      if (distance === bestDistance && boundary >= best) {
        continue;
      }
      best = boundary;
      bestDistance = distance;
    }
  }
  return best;
}

export function snapSpanBoundaries(
  payload: TimelinePayload,
  boundaries: number[],
  toleranceS: number
): TimelinePayload {
  if (boundaries.length === 0 || toleranceS <= 0) {
    return payload;
  }
  const threads = payload.threads.map((thread) => ({
    ...thread,
    spans: thread.spans.map((span) => {
      const startS = nearestBoundary(span.start_s, boundaries, toleranceS);
      const endS = nearestBoundary(span.end_s, boundaries, toleranceS);
      // A short span whose ends snap to the same boundary would collapse to
      // nothing: it would vanish from the map and contribute no playable time.
      if (endS <= startS) {
        return span;
      }
      return { ...span, start_s: startS, end_s: endS };
    }),
  }));
  return { ...payload, threads };
}

function sameTitle(a: string, b: string): boolean {
  return normaliseTitle(a) === normaliseTitle(b);
}

// Halves of one stream are merged by subject: a thread the model recognised in both
// halves becomes one thread holding both halves' spans, rather than two threads that
// would then need re-linking.
export function mergeTimelinePayloads(
  payloads: TimelinePayload[],
  overlapS: number
): TimelinePayload {
  const threads: TimelineThread[] = [];
  const moments: TimelineMoment[] = [];
  const chapters: TimelineChapter[] = [];

  for (const payload of payloads) {
    for (const thread of payload.threads) {
      const existing = threads.find((kept) => sameTitle(kept.title, thread.title));
      if (!existing) {
        threads.push({ ...thread, spans: [...thread.spans] });
        continue;
      }
      for (const span of thread.spans) {
        const duplicate = existing.spans.some(
          (kept) => Math.abs(kept.start_s - span.start_s) <= overlapS
        );
        if (!duplicate) {
          existing.spans.push(span);
        }
      }
    }
    for (const moment of payload.moments) {
      const duplicate = moments.some(
        (kept) =>
          sameTitle(kept.label, moment.label) &&
          Math.abs(kept.peak_s - moment.peak_s) <= overlapS
      );
      if (!duplicate) {
        moments.push(moment);
      }
    }
    for (const chapter of payload.chapters) {
      const duplicate = chapters.some(
        (kept) => Math.abs(kept.start_s - chapter.start_s) <= overlapS
      );
      if (!duplicate) {
        chapters.push(chapter);
      }
    }
  }

  for (const thread of threads) {
    thread.spans.sort((a, b) => a.start_s - b.start_s);
  }
  threads.sort((a, b) => a.spans[0].start_s - b.spans[0].start_s);
  moments.sort((a, b) => a.start_s - b.start_s);
  chapters.sort((a, b) => a.start_s - b.start_s);

  const spine: TimelineChapter[] = [];
  for (const chapter of chapters) {
    if (spine.length === 0 || chapter.start_s > spine[spine.length - 1].start_s) {
      spine.push(chapter);
    }
  }

  return { threads, moments, chapters: spine };
}

import type {
  TimelineChapter,
  TimelineMoment,
  TimelinePayload,
  TimelineScores,
  TimelineSection,
} from "@/lib/timeline.types";

export const SCORE_CRITERIA = ["humour", "interest", "engagement"] as const;

export const PROMPT_VERSION = "timeline-1";

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

export function validateTimelinePayload(
  raw: unknown,
  durationS: number
): TimelinePayload | ValidationFailure {
  if (!isRecord(raw)) {
    return { error: "payload must be a JSON object" };
  }

  const expected = ["sections", "moments", "chapters"];
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

  const sections: TimelineSection[] = [];
  for (const [index, entry] of (raw.sections as unknown[]).entries()) {
    const where = `sections[${index}]`;
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
    let endS: number | null = null;
    if (entry.end_s !== null && entry.end_s !== undefined) {
      if (!isFiniteNumber(entry.end_s)) {
        return { error: `${where}: end_s must be a number or null` };
      }
      if (entry.end_s < entry.start_s) {
        return { error: `${where}: end_s ${entry.end_s} is before start_s ${entry.start_s}` };
      }
      if (entry.end_s > durationS) {
        return {
          error: `${where}: end_s ${entry.end_s} is past the stream duration ${durationS}`,
        };
      }
      endS = entry.end_s;
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
    sections.push({
      start_s: entry.start_s,
      end_s: endS,
      label: entry.label.trim(),
      summary: entry.summary.trim(),
      tags,
      scores,
    });
  }

  const moments: TimelineMoment[] = [];
  for (const [index, entry] of (raw.moments as unknown[]).entries()) {
    const where = `moments[${index}]`;
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
    const endS = entry.end_s === undefined || entry.end_s === null ? entry.start_s : entry.end_s;
    if (!isFiniteNumber(endS)) {
      return { error: `${where}: end_s must be a number` };
    }
    if (endS < entry.start_s) {
      return { error: `${where}: end_s ${endS} is before start_s ${entry.start_s}` };
    }
    if (endS > durationS) {
      return {
        error: `${where}: end_s ${endS} is past the stream duration ${durationS}`,
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
    moments.push({
      start_s: entry.start_s,
      end_s: endS,
      kind: entry.kind.trim(),
      label: entry.label.trim(),
      summary: entry.summary.trim(),
      tags,
      scores,
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

  return { sections, moments, chapters };
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

export function snapSectionBoundaries(
  payload: TimelinePayload,
  boundaries: number[],
  toleranceS: number
): TimelinePayload {
  if (boundaries.length === 0 || toleranceS <= 0) {
    return payload;
  }
  const sections = payload.sections.map((section) => {
    const startS = nearestBoundary(section.start_s, boundaries, toleranceS);
    const endS =
      section.end_s === null
        ? null
        : nearestBoundary(section.end_s, boundaries, toleranceS);
    if (endS !== null && endS < startS) {
      return section;
    }
    return { ...section, start_s: startS, end_s: endS };
  });
  return { ...payload, sections };
}

function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function mergeTimelinePayloads(
  payloads: TimelinePayload[],
  overlapS: number
): TimelinePayload {
  const sections: TimelineSection[] = [];
  const moments: TimelineMoment[] = [];
  const chapters: TimelineChapter[] = [];

  for (const payload of payloads) {
    for (const section of payload.sections) {
      const duplicate = sections.some(
        (kept) =>
          sameLabel(kept.label, section.label) &&
          Math.abs(kept.start_s - section.start_s) <= overlapS
      );
      if (!duplicate) {
        sections.push(section);
      }
    }
    for (const moment of payload.moments) {
      const duplicate = moments.some(
        (kept) =>
          sameLabel(kept.label, moment.label) &&
          Math.abs(kept.start_s - moment.start_s) <= overlapS
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

  sections.sort((a, b) => a.start_s - b.start_s);
  moments.sort((a, b) => a.start_s - b.start_s);
  chapters.sort((a, b) => a.start_s - b.start_s);

  const spine: TimelineChapter[] = [];
  for (const chapter of chapters) {
    if (spine.length === 0 || chapter.start_s > spine[spine.length - 1].start_s) {
      spine.push(chapter);
    }
  }

  return { sections, moments, chapters: spine };
}

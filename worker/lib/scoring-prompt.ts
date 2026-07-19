import { extractJson } from "./claude";

export const VIDSTUBE_MULTIPLIER = 1.5;

export type ScoringOrigin = "vidstube" | "youtube";

export type ScoringMessage = {
  ref: string;
  origin: ScoringOrigin;
  author: string;
  text: string;
};

export type ScoringInput = {
  transcript: string;
  messages: ScoringMessage[];
};

export type FeaturedPick = {
  ref: string;
  score: number;
  categories: string[];
  reason: string;
};

export type AuthorScoreDelta = {
  ref: string;
  engagement: number;
  humour: number;
  contribution: number;
};

export type ModerationAction = "hide" | "ban";

export type ModerationFlag = {
  ref: string;
  action: ModerationAction;
  reason: string;
};

export type ScoreResult = {
  featured: FeaturedPick[];
  scores: AuthorScoreDelta[];
  moderation: ModerationFlag[];
};

const RUBRIC = `You score live-stream chat participation. You are given the recent stream
transcript (what the streamer is saying) and a batch of new chat messages from two
sources: "vidstube" (the native Vids.Tube audience) and "youtube" (simulcast YouTube
chat). Vids.Tube participation matters MORE than YouTube — rate vidstube messages more
generously.

For each message, rate three dimensions 0-100:
- engagement: relevance and responsiveness to what's happening on stream
- humour: how funny/entertaining it is
- contribution: insight, helpfulness, or moving the conversation forward

Then choose the few best messages to FEATURE on the overlay (only genuinely good ones;
feature none if nothing stands out). A featured message gets an overall score 0-100, a
short reason, and 1-3 category tags from: engagement, humour, contribution, insight,
hype, question.

Finally, FLAG any message that clearly breaks chat rules — spam/flooding, slurs, hate,
harassment, threats, or explicit sexual abuse. Be conservative: flag ONLY clear abuse,
never borderline, merely negative, critical, or off-topic messages. For each flag give an
action ("hide" to remove the message, or "ban" for repeat/severe abuse where the author
should be removed) and a short reason. Most batches have NO flags — return an empty list
when nothing clearly breaks the rules.`;

export function buildScoringPrompt(input: ScoringInput): string {
  const messageLines = input.messages
    .map((m, i) => `[m${i}] (${m.origin}) ${m.author}: ${m.text}`)
    .join("\n");

  return `${RUBRIC}

## Recent transcript
${input.transcript || "(no transcript yet)"}

## New chat messages
${messageLines || "(none)"}

## Output
Return ONLY a JSON object, no prose, of this exact shape:
{
  "featured":   [ { "ref": "<ref>", "score": 0-100, "categories": ["..."], "reason": "<short>" } ],
  "scores":     [ { "ref": "<ref>", "engagement": 0-100, "humour": 0-100, "contribution": 0-100 } ],
  "moderation": [ { "ref": "<ref>", "action": "hide"|"ban", "reason": "<short>" } ]
}
Use the exact id shown in [brackets] for each message as its "ref" (e.g. "m0", "m3"). Include every message in "scores". Keep "featured" small and "moderation" usually empty.`;
}

export type HighlightPick = FeaturedPick & AuthorScoreDelta;

const HIGHLIGHT_RUBRIC = `You score live-stream chat messages that the stream OWNER hand-picked to
highlight on the overlay. You are given the recent stream transcript (what the streamer
is saying) and the picked messages, from two sources: "vidstube" (the native Vids.Tube
audience) and "youtube" (simulcast YouTube chat). Vids.Tube participation matters MORE
than YouTube — rate vidstube messages more generously.

For each message, rate three dimensions 0-100:
- engagement: relevance and responsiveness to what's happening on stream
- humour: how funny/entertaining it is
- contribution: insight, helpfulness, or moving the conversation forward

Also give each message an overall highlight score 0-100, a short reason it stands out,
and 1-3 category tags from: engagement, humour, contribution, insight, hype, question.
The owner already chose to feature these messages, so score every one of them — never
skip or reject a message.`;

export function buildHighlightScoringPrompt(input: ScoringInput): string {
  const messageLines = input.messages
    .map((m, i) => `[m${i}] (${m.origin}) ${m.author}: ${m.text}`)
    .join("\n");

  return `${HIGHLIGHT_RUBRIC}

## Recent transcript
${input.transcript || "(no transcript yet)"}

## Owner-picked messages
${messageLines || "(none)"}

## Output
Return ONLY a JSON object, no prose, of this exact shape:
{
  "highlights": [ { "ref": "<ref>", "score": 0-100, "categories": ["..."], "reason": "<short>", "engagement": 0-100, "humour": 0-100, "contribution": 0-100 } ]
}
Use the exact id shown in [brackets] for each message as its "ref" (e.g. "m0", "m3"). Include every message.`;
}

export function parseHighlightResult(raw: string): HighlightPick[] {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return [];
  }
  const obj = parsed as { highlights?: unknown[] };
  if (!Array.isArray(obj.highlights)) {
    return [];
  }
  return obj.highlights
    .map((h) => h as Record<string, unknown>)
    .filter((h) => typeof h.ref === "string")
    .map((h) => ({
      ref: normalizeRef(h.ref),
      score: clampScore(h.score),
      categories: Array.isArray(h.categories)
        ? (h.categories as unknown[]).map(String)
        : [],
      reason: typeof h.reason === "string" ? h.reason : "",
      engagement: clampScore(h.engagement),
      humour: clampScore(h.humour),
      contribution: clampScore(h.contribution),
    }));
}

function normalizeRef(raw: unknown): string {
  return String(raw)
    .trim()
    .replace(/^\[+/, "")
    .replace(/\]+$/, "")
    .replace(/^ref:/i, "")
    .trim();
}

function clampScore(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function parseScoreResult(raw: string): ScoreResult {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { featured: [], scores: [], moderation: [] };
  }
  const obj = parsed as {
    featured?: unknown[];
    scores?: unknown[];
    moderation?: unknown[];
  };

  const featured: FeaturedPick[] = Array.isArray(obj.featured)
    ? obj.featured
        .map((f) => f as Record<string, unknown>)
        .filter((f) => typeof f.ref === "string")
        .map((f) => ({
          ref: normalizeRef(f.ref),
          score: clampScore(f.score),
          categories: Array.isArray(f.categories)
            ? (f.categories as unknown[]).map(String)
            : [],
          reason: typeof f.reason === "string" ? f.reason : "",
        }))
    : [];

  const scores: AuthorScoreDelta[] = Array.isArray(obj.scores)
    ? obj.scores
        .map((s) => s as Record<string, unknown>)
        .filter((s) => typeof s.ref === "string")
        .map((s) => ({
          ref: normalizeRef(s.ref),
          engagement: clampScore(s.engagement),
          humour: clampScore(s.humour),
          contribution: clampScore(s.contribution),
        }))
    : [];

  const moderation: ModerationFlag[] = Array.isArray(obj.moderation)
    ? obj.moderation
        .map((m) => m as Record<string, unknown>)
        .filter(
          (m) =>
            typeof m.ref === "string" &&
            (m.action === "hide" || m.action === "ban")
        )
        .map((m) => ({
          ref: normalizeRef(m.ref),
          action: m.action as ModerationAction,
          reason: typeof m.reason === "string" ? m.reason : "",
        }))
    : [];

  return { featured, scores, moderation };
}

export function pointsFor(delta: AuthorScoreDelta, origin: ScoringOrigin): number {
  const base = delta.engagement + delta.humour + delta.contribution;
  const weighted = origin === "vidstube" ? base * VIDSTUBE_MULTIPLIER : base;
  return Math.round(weighted);
}

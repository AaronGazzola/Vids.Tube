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

export type ScoreResult = {
  featured: FeaturedPick[];
  scores: AuthorScoreDelta[];
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
hype, question.`;

export function buildScoringPrompt(input: ScoringInput): string {
  const messageLines = input.messages
    .map((m) => `[ref:${m.ref}] (${m.origin}) ${m.author}: ${m.text}`)
    .join("\n");

  return `${RUBRIC}

## Recent transcript
${input.transcript || "(no transcript yet)"}

## New chat messages
${messageLines || "(none)"}

## Output
Return ONLY a JSON object, no prose, of this exact shape:
{
  "featured": [ { "ref": "<ref>", "score": 0-100, "categories": ["..."], "reason": "<short>" } ],
  "scores":   [ { "ref": "<ref>", "engagement": 0-100, "humour": 0-100, "contribution": 0-100 } ]
}
Use the exact "ref" values given. Include every message in "scores". Keep "featured" small.`;
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
    return { featured: [], scores: [] };
  }
  const obj = parsed as {
    featured?: unknown[];
    scores?: unknown[];
  };

  const featured: FeaturedPick[] = Array.isArray(obj.featured)
    ? obj.featured
        .map((f) => f as Record<string, unknown>)
        .filter((f) => typeof f.ref === "string")
        .map((f) => ({
          ref: f.ref as string,
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
          ref: s.ref as string,
          engagement: clampScore(s.engagement),
          humour: clampScore(s.humour),
          contribution: clampScore(s.contribution),
        }))
    : [];

  return { featured, scores };
}

export function pointsFor(delta: AuthorScoreDelta, origin: ScoringOrigin): number {
  const base = delta.engagement + delta.humour + delta.contribution;
  const weighted = origin === "vidstube" ? base * VIDSTUBE_MULTIPLIER : base;
  return Math.round(weighted);
}

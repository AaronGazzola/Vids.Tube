import { SCORING_CONFIG } from "./scoring-config";

export type Dimensions = {
  humour: number;
  insight: number;
  community: number;
};

// A message excels at one thing or none. Taking the best dimension rather than
// summing or averaging means a genuinely funny message is not marked down for
// carrying no insight, and a thoughtful one is not marked down for not being
// funny. Summing also tripled the magnitude without adding any discrimination,
// because the three dimensions move together.
export function messageQuality(d: Dimensions): number {
  return Math.max(d.humour, d.insight, d.community);
}

// Ordinary chat pays nothing. Above the threshold the curve rises steeply, so a
// chatter who sends a hundred unremarkable messages earns close to zero while a
// chatter who sends a handful of good ones earns real points. This is what stops
// the score being a message counter.
export function pointsForQuality(quality: number, origin: string): number {
  const { qualityThreshold, curveExponent, maxPointsPerMessage, vidstubeMultiplier } =
    SCORING_CONFIG;
  if (quality <= qualityThreshold) return 0;
  const headroom = 100 - qualityThreshold;
  const normalised = Math.min((quality - qualityThreshold) / headroom, 1);
  const base = Math.pow(normalised, curveExponent) * maxPointsPerMessage;
  const weighted = origin === "vidstube" ? base * vidstubeMultiplier : base;
  return Math.round(weighted);
}

export function pointsForMessage(d: Dimensions, origin: string): number {
  return pointsForQuality(messageQuality(d), origin);
}

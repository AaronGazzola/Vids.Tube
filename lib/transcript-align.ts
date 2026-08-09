// Measures how far into one recording another one begins, by aligning the
// speech in both rather than by trusting either one's timestamps.
//
// The 8-Aug-2026 broadcast is why this exists: its recording runs 9,935
// seconds, its live portion 8,508, and its pre-live gap 2,719. Those do not
// reconcile, so at least two of the three are wrong, and picking among them is
// guesswork. The speech in the two files cannot drift.

export type Segment = { startS: number; text: string };

export type Alignment = {
  offsetS: number;
  matched: number;
  runnerUpMatched: number;
  runnerUpOffsetS: number;
  residuals: { atS: number; residualS: number }[];
  confident: boolean;
};

export type DriftReport = {
  slopePerHour: number;
  firstDriftAtS: number | null;
  spreadS: number;
  flat: boolean;
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "so", "of", "to", "in", "on", "at",
  "is", "it", "that", "this", "i", "you", "we", "they", "was", "are", "be",
]);

export function normaliseWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// A segment is identified by the words in it that carry information. Ordinary
// transcription noise moves and drops words, so a fingerprint that survives
// that is a set of the uncommon ones rather than the exact sequence.
function fingerprint(text: string): Set<string> {
  return new Set(normaliseWords(text).filter((w) => w.length > 3 && !STOP_WORDS.has(w)));
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

type Prepared = { startS: number; words: Set<string> };

function prepare(segments: Segment[]): Prepared[] {
  return segments
    .map((s) => ({ startS: s.startS, words: fingerprint(s.text) }))
    .filter((s) => s.words.size >= 3)
    .sort((a, b) => a.startS - b.startS);
}

// How close a shifted segment has to land to count as found, and how alike the
// words have to be. Both are deliberately loose: the score is a count of
// agreements, and a wrong lag produces almost none however loose the test.
const WINDOW_S = 12;
const SIMILARITY = 0.4;

function scoreLag(
  oldSegs: Prepared[],
  newSegs: Prepared[],
  lag: number
): { matched: number; residuals: { atS: number; residualS: number }[] } {
  const residuals: { atS: number; residualS: number }[] = [];
  let matched = 0;
  let cursor = 0;

  for (const seg of oldSegs) {
    const target = seg.startS - lag;
    while (cursor > 0 && newSegs[cursor - 1].startS > target - WINDOW_S) cursor -= 1;
    while (cursor < newSegs.length && newSegs[cursor].startS < target - WINDOW_S) cursor += 1;

    let best = 0;
    let bestAt: number | null = null;
    for (let i = cursor; i < newSegs.length && newSegs[i].startS <= target + WINDOW_S; i += 1) {
      const score = overlap(seg.words, newSegs[i].words);
      if (score > best) {
        best = score;
        bestAt = newSegs[i].startS;
      }
    }
    if (best >= SIMILARITY && bestAt !== null) {
      matched += 1;
      residuals.push({ atS: seg.startS, residualS: seg.startS - bestAt - lag });
    }
  }

  return { matched, residuals };
}

// A coarse sweep finds the neighbourhood, then a fine one finds the second.
// Scanning the whole plausible range at full resolution would cost far more for
// the same answer.
export function alignByLag(
  oldSegments: Segment[],
  newSegments: Segment[],
  range: { minS: number; maxS: number }
): Alignment {
  const oldSegs = prepare(oldSegments);
  const newSegs = prepare(newSegments);

  if (!oldSegs.length || !newSegs.length) {
    return {
      offsetS: 0,
      matched: 0,
      runnerUpMatched: 0,
      runnerUpOffsetS: 0,
      residuals: [],
      confident: false,
    };
  }

  const sweep = (from: number, to: number, step: number) => {
    const scored: { lag: number; matched: number }[] = [];
    for (let lag = from; lag <= to; lag += step) {
      scored.push({ lag, matched: scoreLag(oldSegs, newSegs, lag).matched });
    }
    return scored.sort((a, b) => b.matched - a.matched);
  };

  // The coarse sweep finds the neighbourhood, and cannot do better than that:
  // every lag within the match window scores identically, so counting alone
  // returns a plateau rather than a value. The exact offset comes from the
  // matched pairs themselves — the median of how far each one actually moved,
  // which is unbiased under noise and exact on a clean shift.
  const coarse = sweep(range.minS, range.maxS, 10);
  const around = coarse[0]?.lag ?? 0;

  const refine = (lag: number): number => {
    const pairs = scoreLag(oldSegs, newSegs, lag).residuals;
    if (!pairs.length) return lag;
    const deltas = pairs.map((p) => p.residualS).sort((a, b) => a - b);
    const mid = Math.floor(deltas.length / 2);
    const median =
      deltas.length % 2 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
    return lag + median;
  };

  // One refinement lands it; a second confirms the first was not thrown by a
  // lopsided match set at the coarse lag.
  const offsetS = refine(refine(around));
  const { matched, residuals } = scoreLag(oldSegs, newSegs, offsetS);
  const winner = { lag: offsetS, matched };

  // The runner-up must be a genuinely different answer, not the same peak one
  // second over, or every alignment would look unconfident.
  const runnerUp =
    coarse.find((c) => Math.abs(c.lag - winner.lag) > 60) ?? { lag: 0, matched: 0 };

  const confident =
    matched >= Math.max(20, oldSegs.length * 0.2) &&
    matched >= runnerUp.matched * 3;

  return {
    offsetS: winner.lag,
    matched,
    runnerUpMatched: runnerUp.matched,
    runnerUpOffsetS: runnerUp.lag,
    residuals,
    confident,
  };
}

// A single offset only describes the difference when the residuals stay flat.
//
// This catches gradual drift, such as a replacement running at a slightly
// different rate. It does not catch an interior cut, and does not need to: a
// cut produces two clusters rather than a slope, no single lag fits both, and
// neither cluster can then beat the other by the margin `confident` requires.
// The two checks cover different failures and both must pass.
export function residualDrift(
  residuals: { atS: number; residualS: number }[],
  slopeTolerancePerHourS = 5,
  spreadToleranceS = 15
): DriftReport {
  if (residuals.length < 4) {
    return { slopePerHour: 0, firstDriftAtS: null, spreadS: 0, flat: true };
  }

  const n = residuals.length;
  const meanX = residuals.reduce((s, r) => s + r.atS, 0) / n;
  const meanY = residuals.reduce((s, r) => s + r.residualS, 0) / n;
  let num = 0;
  let den = 0;
  for (const r of residuals) {
    num += (r.atS - meanX) * (r.residualS - meanY);
    den += (r.atS - meanX) ** 2;
  }
  const slopePerHour = den === 0 ? 0 : (num / den) * 3600;

  // Spread is measured at a high percentile rather than at the worst point.
  // Captions are grouped into spans, so a correctly matched pair can legitimately
  // sit several seconds from where a single offset predicts, and one outlier
  // among a thousand agreements says nothing. A genuine step change moves a
  // large share of the points at once, which a percentile catches and a maximum
  // cannot distinguish from noise.
  const deviations = residuals
    .map((r) => Math.abs(r.residualS - meanY))
    .sort((a, b) => a - b);
  const spreadS = deviations[Math.floor(deviations.length * 0.9)] ?? 0;

  const firstDrift =
    residuals.find((r) => Math.abs(r.residualS - meanY) > spreadToleranceS)
      ?.atS ?? null;

  return {
    slopePerHour,
    firstDriftAtS: firstDrift,
    spreadS,
    flat:
      Math.abs(slopePerHour) <= slopeTolerancePerHourS &&
      spreadS <= spreadToleranceS,
  };
}

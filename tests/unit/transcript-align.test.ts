import { describe, expect, it } from "vitest";
import {
  alignByLag,
  normaliseWords,
  residualDrift,
  type Segment,
} from "@/lib/transcript-align";

// Sentences with enough uncommon words to be identifiable, which is what a real
// transcript of someone explaining something looks like.
const PHRASES = [
  "deploying the migration against production without a rollback",
  "the encoder reconnected halfway through the broadcast",
  "chatters keep asking about the credit balance calculation",
  "whisper transcription lagging behind the audio buffer",
  "cloudflare cached the thumbnail before it finished uploading",
  "membership recompute takes longer than the scoring pass",
  "nightbot truncates anything past two hundred characters",
  "supabase policies evaluate once per row unless wrapped",
  "the overlay layout pushes through realtime subscriptions",
  "shorts rendering needs the timeline threads to be fused",
];

const VOCABULARY = PHRASES.join(" ").split(" ").filter((w) => w.length > 3);

// Segments must differ from each other the way real speech does. An earlier
// fixture reused whole phrases with one word changed, which made segments 150
// seconds apart near-identical and the alignment genuinely ambiguous. The
// aligner was right to refuse it, so ambiguity now has its own test instead of
// contaminating every other one.
function transcript(count: number, startAt = 0, gap = 30): Segment[] {
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: count }, (_, i) => {
    const words = Array.from(
      { length: 9 },
      () => VOCABULARY[Math.floor(next() * VOCABULARY.length)]
    );
    return { startS: startAt + i * gap, text: `${words.join(" ")} marker${i}xyz` };
  });
}

function shift(segments: Segment[], by: number): Segment[] {
  return segments.map((s) => ({ ...s, startS: s.startS - by }));
}

describe("normaliseWords", () => {
  it("lower-cases, strips punctuation and collapses whitespace", () => {
    expect(normaliseWords("  Hello,   THERE! it's  fine. ")).toEqual([
      "hello",
      "there",
      "it",
      "s",
      "fine",
    ]);
  });
});

describe("alignByLag", () => {
  it("measures a clean shift exactly", () => {
    const original = transcript(60);
    const replacement = shift(original, 2719);

    const result = alignByLag(original, replacement, { minS: 0, maxS: 4000 });

    expect(result.offsetS).toBe(2719);
    expect(result.confident).toBe(true);
  });

  it("survives dropped words, substituted words and moved boundaries", () => {
    const original = transcript(60);
    const noisy = shift(original, 1200).map((s, i) => {
      const words = s.text.split(" ");
      if (i % 3 === 0) words.splice(1, 1);
      if (i % 4 === 0) words[words.length - 1] = "approximately";
      return { startS: s.startS + (i % 2 ? 1.5 : -1.5), text: words.join(" ") };
    });

    const result = alignByLag(original, noisy, { minS: 0, maxS: 4000 });

    expect(Math.abs(result.offsetS - 1200)).toBeLessThanOrEqual(2);
    expect(result.confident).toBe(true);
  });

  it("finds no confident winner between unrelated transcripts", () => {
    const original = transcript(60);
    const unrelated: Segment[] = Array.from({ length: 60 }, (_, i) => ({
      startS: i * 30,
      text: `completely unrelated dragon husbandry lecture segment ${i}`,
    }));

    const result = alignByLag(original, unrelated, { minS: 0, maxS: 4000 });

    expect(result.confident).toBe(false);
  });

  it("refuses when either side has nothing to align", () => {
    expect(alignByLag([], transcript(20), { minS: 0, maxS: 100 }).confident).toBe(
      false
    );
    expect(alignByLag(transcript(20), [], { minS: 0, maxS: 100 }).confident).toBe(
      false
    );
  });
});

describe("residualDrift", () => {
  it("reads a clean trim as flat", () => {
    const original = transcript(60);
    const replacement = shift(original, 900);
    const { residuals } = alignByLag(original, replacement, {
      minS: 0,
      maxS: 2000,
    });

    expect(residualDrift(residuals).flat).toBe(true);
  });

  it("reports gradual drift, which one offset cannot describe", () => {
    // A replacement running at a slightly different rate: each segment lands a
    // little further from where a single offset predicts.
    const original = transcript(60);
    const stretched = original.map((s, i) => ({
      ...s,
      startS: s.startS - 600 + i * 0.4,
    }));

    const { residuals } = alignByLag(original, stretched, {
      minS: 0,
      maxS: 2000,
    });
    const drift = residualDrift(residuals);

    expect(drift.flat).toBe(false);
    expect(Math.abs(drift.slopePerHour)).toBeGreaterThan(3);
  });

  it("treats too few residuals as nothing to judge", () => {
    expect(residualDrift([{ atS: 0, residualS: 0 }]).flat).toBe(true);
  });
});

describe("an interior cut is refused", () => {
  it("refuses a replacement that lost a section from the middle", () => {
    // Everything after the halfway point moves an extra 120 seconds earlier,
    // which is what removing two minutes from the middle looks like. No single
    // offset fits both halves, so neither half can win by a clear margin.
    const original = transcript(60);
    const cut = original.map((s, i) => ({
      ...s,
      startS: s.startS - 600 - (i >= 30 ? 120 : 0),
    }));

    const result = alignByLag(original, cut, { minS: 0, maxS: 2000 });

    expect(result.confident).toBe(false);
  });

});

describe("an ambiguous transcript is refused rather than guessed", () => {
  it("refuses when whole segments repeat, so several lags fit equally well", () => {
    // A recording where the same few sentences cycle has no single right
    // answer: shifting by one cycle fits almost as well as not shifting.
    const repeating: Segment[] = Array.from({ length: 60 }, (_, i) => ({
      startS: i * 30,
      text: PHRASES[i % 5],
    }));
    const shifted = repeating.map((s) => ({ ...s, startS: s.startS - 900 }));

    const result = alignByLag(repeating, shifted, { minS: 0, maxS: 2000 });

    expect(result.confident).toBe(false);
  });
});

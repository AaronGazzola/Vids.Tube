import { describe, expect, it } from "vitest";
import {
  batchMessages,
  eligibleForScoring,
  transcriptWindow,
  type ScorableMessage,
  type TranscriptSegment,
} from "@/lib/scoring-batches";
import {
  messageQuality,
  pointsForMessage,
  pointsForQuality,
} from "@/lib/scoring-points";
import { buildRubric, SCORING_CONFIG } from "@/lib/scoring-config";

const HOST = "e64c4fed-0000-0000-0000-000000000000";

const msg = (over: Partial<ScorableMessage> = {}): ScorableMessage => ({
  id: "m1",
  origin: "youtube",
  userId: null,
  externalAuthorId: "UCsomeone",
  authorName: "someone",
  body: "hello",
  createdAt: "2026-06-16T14:10:00.000Z",
  ...over,
});

describe("eligibleForScoring", () => {
  it("drops bot messages", () => {
    const out = eligibleForScoring([msg(), msg({ id: "m2", origin: "bot" })], HOST);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("m1");
  });

  it("drops the host's own messages", () => {
    const out = eligibleForScoring(
      [msg(), msg({ id: "m2", origin: "youtube", userId: HOST })],
      HOST
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("m1");
  });

  it("keeps site-typed messages from ordinary viewers", () => {
    const out = eligibleForScoring(
      [msg({ id: "m2", origin: "vidstube", userId: "someone-else" })],
      HOST
    );
    expect(out).toHaveLength(1);
  });

  it("keeps everything when no host is known", () => {
    const out = eligibleForScoring([msg({ userId: "anyone" })], null);
    expect(out).toHaveLength(1);
  });
});

describe("batchMessages", () => {
  it("splits into batches of at most twenty-five", () => {
    const many = Array.from({ length: 60 }, (_, i) => msg({ id: `m${i}` }));
    const batches = batchMessages(many);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(25);
    expect(batches[2]).toHaveLength(10);
  });

  it("returns nothing for no messages", () => {
    expect(batchMessages([])).toHaveLength(0);
  });

  it("keeps messages in order", () => {
    const many = Array.from({ length: 30 }, (_, i) => msg({ id: `m${i}` }));
    const flat = batchMessages(many).flat();
    expect(flat.map((m) => m.id)).toEqual(many.map((m) => m.id));
  });
});

describe("transcriptWindow", () => {
  const segments: TranscriptSegment[] = [
    { start_s: 0, end_s: 100, text: "opening" },
    { start_s: 500, end_s: 600, text: "middle" },
    { start_s: 5000, end_s: 5100, text: "much later" },
  ];
  const start = "2026-06-16T14:00:00.000Z";

  it("returns the segments spanning the batch", () => {
    const batch = [
      msg({ createdAt: "2026-06-16T14:09:00.000Z" }),
      msg({ id: "m2", createdAt: "2026-06-16T14:10:00.000Z" }),
    ];
    expect(transcriptWindow(segments, batch, start)).toBe("middle");
  });

  it("leaves out parts of the broadcast the batch was nowhere near", () => {
    const batch = [msg({ createdAt: "2026-06-16T14:09:00.000Z" })];
    expect(transcriptWindow(segments, batch, start)).not.toContain("much later");
  });

  it("returns nothing rather than throwing when there is no transcript", () => {
    expect(transcriptWindow([], [msg()], start)).toBe("");
  });

  it("returns nothing for an empty batch", () => {
    expect(transcriptWindow(segments, [], start)).toBe("");
  });
});

describe("the scoring configuration", () => {
  it("names all three criteria", () => {
    const names = SCORING_CONFIG.criteria.map((c) => c.name);
    expect(names).toEqual(["humour", "insight", "community"]);
  });

  it("carries a version", () => {
    expect(SCORING_CONFIG.version.length).toBeGreaterThan(0);
  });

  it("gives the live scorer the moderation instructions", () => {
    expect(buildRubric({ includeModeration: true })).toContain("FLAG any message");
  });

  it("withholds moderation from the backfill", () => {
    expect(buildRubric({ includeModeration: false })).not.toContain("FLAG any message");
  });

  it("asks for all three ratings in both forms", () => {
    for (const includeModeration of [true, false]) {
      const rubric = buildRubric({ includeModeration });
      expect(rubric).toContain("humour");
      expect(rubric).toContain("insight");
      expect(rubric).toContain("community");
    }
  });
});

describe("pointsForQuality", () => {
  it("pays nothing for ordinary chat", () => {
    expect(pointsForQuality(0, "youtube")).toBe(0);
    expect(pointsForQuality(45, "youtube")).toBe(0);
    expect(pointsForQuality(60, "youtube")).toBe(0);
  });

  it("pays the full ceiling only for a perfect message", () => {
    expect(pointsForQuality(100, "youtube")).toBe(SCORING_CONFIG.maxPointsPerMessage);
  });

  it("rises steeply rather than evenly above the threshold", () => {
    const t = SCORING_CONFIG.qualityThreshold;
    const quarter = pointsForQuality(t + (100 - t) * 0.25, "youtube");
    const half = pointsForQuality(t + (100 - t) * 0.5, "youtube");
    const full = pointsForQuality(100, "youtube");
    expect(quarter).toBeLessThan(full * 0.25);
    expect(half).toBeLessThan(full * 0.5);
    expect(quarter).toBeLessThan(half);
  });

  it("rewards site-typed messages more", () => {
    expect(pointsForQuality(100, "vidstube")).toBe(
      Math.round(SCORING_CONFIG.maxPointsPerMessage * SCORING_CONFIG.vidstubeMultiplier)
    );
  });

  it("takes the best dimension rather than the sum", () => {
    const funnyOnly = { humour: 90, insight: 0, community: 0 };
    const evenlyMediocre = { humour: 50, insight: 50, community: 50 };
    expect(messageQuality(funnyOnly)).toBe(90);
    expect(messageQuality(evenlyMediocre)).toBe(50);
    expect(pointsForMessage(funnyOnly, "youtube")).toBeGreaterThan(
      pointsForMessage(evenlyMediocre, "youtube")
    );
  });

  it("makes a hundred ordinary messages worth less than five good ones", () => {
    const ordinary = { humour: 40, insight: 40, community: 40 };
    const good = { humour: 80, insight: 20, community: 20 };
    const volume = 100 * pointsForMessage(ordinary, "youtube");
    const quality = 5 * pointsForMessage(good, "youtube");
    expect(volume).toBe(0);
    expect(quality).toBeGreaterThan(volume);
  });
});

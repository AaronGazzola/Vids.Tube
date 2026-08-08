import { describe, expect, it } from "vitest";
import { mergeTimelinePayloads } from "@/lib/timeline";
import type {
  TimelineMoment,
  TimelinePayload,
  TimelineThread,
} from "@/lib/timeline.types";

const scores = { humour: 10, interest: 20, engagement: 30 };
const OVERLAP = 120;

function thread(title: string, ...spans: [number, number][]): TimelineThread {
  return {
    title,
    summary: "",
    tags: [],
    scores,
    spans: spans.map(([start_s, end_s]) => ({
      start_s,
      end_s,
      label: "part",
      scores,
    })),
  };
}

function moment(peak_s: number, label: string): TimelineMoment {
  return {
    start_s: peak_s - 10,
    peak_s,
    end_s: peak_s + 10,
    kind: "joke",
    label,
    summary: "",
    tags: [],
    scores,
    thread: null,
  };
}

function payload(overrides: Partial<TimelinePayload> = {}): TimelinePayload {
  return { threads: [], moments: [], chapters: [], ...overrides };
}

describe("merging the halves of one stream", () => {
  it("folds a subject recognised in both halves into one thread", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ threads: [thread("account linking", [100, 200])] }),
        payload({ threads: [thread("Account Linking", [3000, 3100])] }),
      ],
      OVERLAP
    );
    expect(merged.threads).toHaveLength(1);
    expect(merged.threads[0].spans).toHaveLength(2);
  });

  it("keeps two genuinely different subjects apart", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ threads: [thread("account linking", [100, 200])] }),
        payload({ threads: [thread("the mustache mystery", [3000, 3100])] }),
      ],
      OVERLAP
    );
    expect(merged.threads).toHaveLength(2);
  });

  it("does not duplicate a span the two halves both saw at the seam", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ threads: [thread("t", [1800, 1900])] }),
        payload({ threads: [thread("t", [1820, 1900])] }),
      ],
      OVERLAP
    );
    expect(merged.threads[0].spans).toHaveLength(1);
  });

  it("keeps two spans of one subject that are genuinely far apart", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ threads: [thread("t", [100, 200])] }),
        payload({ threads: [thread("t", [3000, 3100])] }),
      ],
      OVERLAP
    );
    expect(merged.threads[0].spans).toHaveLength(2);
  });

  it("puts a merged thread's spans back in time order", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ threads: [thread("t", [3000, 3100])] }),
        payload({ threads: [thread("t", [100, 200])] }),
      ],
      OVERLAP
    );
    expect(merged.threads[0].spans.map((s) => s.start_s)).toEqual([100, 3000]);
  });

  it("drops a moment both halves reported at the same peak", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ moments: [moment(1800, "laugh")] }),
        payload({ moments: [moment(1820, "laugh")] }),
      ],
      OVERLAP
    );
    expect(merged.moments).toHaveLength(1);
  });

  it("keeps two moments that share a label but not a place", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({ moments: [moment(100, "laugh")] }),
        payload({ moments: [moment(3000, "laugh")] }),
      ],
      OVERLAP
    );
    expect(merged.moments).toHaveLength(2);
  });

  it("keeps the chapter spine strictly increasing", () => {
    const merged = mergeTimelinePayloads(
      [
        payload({
          chapters: [
            { start_s: 0, title: "One" },
            { start_s: 1800, title: "Two" },
          ],
        }),
        payload({
          chapters: [
            { start_s: 1810, title: "Two again" },
            { start_s: 3000, title: "Three" },
          ],
        }),
      ],
      OVERLAP
    );
    expect(merged.chapters.map((c) => c.start_s)).toEqual([0, 1800, 3000]);
  });
});

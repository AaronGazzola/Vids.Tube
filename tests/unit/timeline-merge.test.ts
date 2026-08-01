import { describe, expect, it } from "vitest";
import { mergeTimelinePayloads } from "@/lib/timeline";
import type { TimelinePayload } from "@/lib/timeline.types";

const scores = { humour: 10, interest: 20, engagement: 30 };

function section(start_s: number, label: string): TimelinePayload["sections"][number] {
  return { start_s, end_s: start_s + 60, label, summary: "", tags: [], scores };
}

function moment(start_s: number, label: string): TimelinePayload["moments"][number] {
  return {
    start_s,
    end_s: start_s,
    kind: "joke",
    label,
    summary: "",
    tags: [],
    scores,
  };
}

describe("mergeTimelinePayloads", () => {
  it("concatenates payloads that do not overlap", () => {
    const merged = mergeTimelinePayloads(
      [
        { sections: [section(0, "a")], moments: [], chapters: [{ start_s: 0, title: "One" }] },
        {
          sections: [section(600, "b")],
          moments: [],
          chapters: [{ start_s: 600, title: "Two" }],
        },
      ],
      30
    );
    expect(merged.sections.map((s) => s.label)).toEqual(["a", "b"]);
    expect(merged.chapters.map((c) => c.title)).toEqual(["One", "Two"]);
  });

  it("drops a section duplicated across the seam", () => {
    const merged = mergeTimelinePayloads(
      [
        { sections: [section(590, "shared")], moments: [], chapters: [] },
        { sections: [section(600, "Shared")], moments: [], chapters: [] },
      ],
      30
    );
    expect(merged.sections).toHaveLength(1);
    expect(merged.sections[0].start_s).toBe(590);
  });

  it("keeps a same-labelled entry outside the overlap window", () => {
    const merged = mergeTimelinePayloads(
      [
        { sections: [section(100, "shared")], moments: [], chapters: [] },
        { sections: [section(900, "shared")], moments: [], chapters: [] },
      ],
      30
    );
    expect(merged.sections).toHaveLength(2);
  });

  it("keeps a differently-labelled entry inside the overlap window", () => {
    const merged = mergeTimelinePayloads(
      [
        { sections: [section(590, "one")], moments: [], chapters: [] },
        { sections: [section(600, "two")], moments: [], chapters: [] },
      ],
      30
    );
    expect(merged.sections.map((s) => s.label)).toEqual(["one", "two"]);
  });

  it("dedupes moments the same way", () => {
    const merged = mergeTimelinePayloads(
      [
        { sections: [], moments: [moment(595, "laugh")], chapters: [] },
        { sections: [], moments: [moment(600, "laugh")], chapters: [] },
      ],
      30
    );
    expect(merged.moments).toHaveLength(1);
  });

  it("keeps the merged chapter spine strictly increasing", () => {
    const merged = mergeTimelinePayloads(
      [
        {
          sections: [],
          moments: [],
          chapters: [
            { start_s: 0, title: "One" },
            { start_s: 600, title: "Two" },
          ],
        },
        {
          sections: [],
          moments: [],
          chapters: [
            { start_s: 610, title: "Two again" },
            { start_s: 1200, title: "Three" },
          ],
        },
      ],
      30
    );
    expect(merged.chapters.map((c) => c.start_s)).toEqual([0, 600, 1200]);
    for (let i = 1; i < merged.chapters.length; i += 1) {
      expect(merged.chapters[i].start_s).toBeGreaterThan(
        merged.chapters[i - 1].start_s
      );
    }
  });

  it("sorts the merged output by start time", () => {
    const merged = mergeTimelinePayloads(
      [
        { sections: [section(900, "late")], moments: [], chapters: [] },
        { sections: [section(100, "early")], moments: [], chapters: [] },
      ],
      30
    );
    expect(merged.sections.map((s) => s.label)).toEqual(["early", "late"]);
  });
});

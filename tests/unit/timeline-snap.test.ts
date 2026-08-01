import { describe, expect, it } from "vitest";
import { snapSectionBoundaries } from "@/lib/timeline";
import type { TimelinePayload } from "@/lib/timeline.types";

const scores = { humour: 10, interest: 20, engagement: 30 };

function payload(
  sections: TimelinePayload["sections"],
  overrides: Partial<TimelinePayload> = {}
): TimelinePayload {
  return {
    sections,
    moments: [
      {
        start_s: 100.4,
        end_s: 100.4,
        kind: "joke",
        label: "laugh",
        summary: "",
        tags: [],
        scores,
      },
    ],
    chapters: [{ start_s: 0, title: "Intro" }],
    ...overrides,
  };
}

function section(start_s: number, end_s: number | null) {
  return {
    start_s,
    end_s,
    label: "section",
    summary: "",
    tags: [],
    scores,
  };
}

describe("snapSectionBoundaries", () => {
  it("snaps a boundary that falls within the tolerance", () => {
    const result = snapSectionBoundaries(
      payload([section(100.4, 300.2)]),
      [0, 100, 300, 600],
      2
    );
    expect(result.sections[0].start_s).toBe(100);
    expect(result.sections[0].end_s).toBe(300);
  });

  it("leaves a boundary outside the tolerance alone", () => {
    const result = snapSectionBoundaries(
      payload([section(150, 400)]),
      [0, 100, 300, 600],
      2
    );
    expect(result.sections[0].start_s).toBe(150);
    expect(result.sections[0].end_s).toBe(400);
  });

  it("snaps to the nearer of two candidate boundaries", () => {
    const result = snapSectionBoundaries(
      payload([section(104, 500)]),
      [100, 105, 500],
      6
    );
    expect(result.sections[0].start_s).toBe(105);
  });

  it("leaves a null end_s null", () => {
    const result = snapSectionBoundaries(
      payload([section(100.4, null)]),
      [0, 100, 300],
      2
    );
    expect(result.sections[0].start_s).toBe(100);
    expect(result.sections[0].end_s).toBeNull();
  });

  it("never produces an end before its start", () => {
    const boundaries = [0, 98, 100, 102, 300, 305, 600];
    const cases: [number, number][] = [
      [99, 101],
      [100, 100],
      [99, 99.5],
      [297, 303],
      [101, 299],
    ];
    for (const [start, end] of cases) {
      const result = snapSectionBoundaries(
        payload([section(start, end)]),
        boundaries,
        5
      );
      const snapped = result.sections[0];
      expect(snapped.end_s).not.toBeNull();
      expect(snapped.end_s as number).toBeGreaterThanOrEqual(snapped.start_s);
    }
  });

  it("does not snap moments", () => {
    const result = snapSectionBoundaries(
      payload([section(100.4, 300.2)]),
      [0, 100, 300, 600],
      2
    );
    expect(result.moments[0].start_s).toBe(100.4);
    expect(result.moments[0].end_s).toBe(100.4);
  });

  it("does not snap chapters", () => {
    const result = snapSectionBoundaries(
      payload([section(100.4, 300.2)], {
        chapters: [{ start_s: 0, title: "Intro" }, { start_s: 299.6, title: "Deploy" }],
      }),
      [0, 100, 300, 600],
      2
    );
    expect(result.chapters[1].start_s).toBe(299.6);
  });

  it("returns the payload unchanged when there are no boundaries", () => {
    const input = payload([section(100.4, 300.2)]);
    expect(snapSectionBoundaries(input, [], 2)).toBe(input);
  });
});

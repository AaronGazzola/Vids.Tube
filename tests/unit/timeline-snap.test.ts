import { describe, expect, it } from "vitest";
import { snapSpanBoundaries } from "@/lib/timeline";
import type { TimelinePayload, TimelineSpan } from "@/lib/timeline.types";

const scores = { humour: 10, interest: 20, engagement: 30 };

function span(start_s: number, end_s: number): TimelineSpan {
  return { start_s, end_s, label: "part", scores };
}

function payload(spans: TimelineSpan[]): TimelinePayload {
  return {
    threads: [
      { title: "t", summary: "", tags: [], scores, spans },
    ],
    moments: [
      {
        start_s: 100.4,
        peak_s: 105,
        end_s: 110,
        kind: "joke",
        label: "laugh",
        summary: "",
        tags: [],
        scores,
        thread: null,
      },
    ],
    chapters: [{ start_s: 0, title: "Intro" }],
  };
}

const BOUNDARIES = [0, 10, 20, 100, 200, 300];

function spansOf(result: TimelinePayload): TimelineSpan[] {
  return result.threads[0].spans;
}

describe("snapSpanBoundaries", () => {
  it("pulls a start onto a nearby transcript boundary", () => {
    const result = snapSpanBoundaries(payload([span(98, 205)]), BOUNDARIES, 5);
    expect(spansOf(result)[0].start_s).toBe(100);
  });

  it("pulls an end onto a nearby transcript boundary", () => {
    const result = snapSpanBoundaries(payload([span(98, 205)]), BOUNDARIES, 5);
    expect(spansOf(result)[0].end_s).toBe(200);
  });

  it("leaves a boundary alone when nothing is close enough", () => {
    const result = snapSpanBoundaries(payload([span(150, 250)]), BOUNDARIES, 5);
    expect(spansOf(result)[0]).toEqual(span(150, 250));
  });

  it("snaps every span of a thread, not only the first", () => {
    const result = snapSpanBoundaries(
      payload([span(1, 12), span(98, 202)]),
      BOUNDARIES,
      5
    );
    expect(spansOf(result).map((s) => [s.start_s, s.end_s])).toEqual([
      [0, 10],
      [100, 200],
    ]);
  });

  it("leaves a span alone when snapping would collapse it to nothing", () => {
    const result = snapSpanBoundaries(payload([span(99, 101)]), [100], 5);
    expect(spansOf(result)[0]).toEqual(span(99, 101));
  });


  it("does nothing without boundaries", () => {
    const result = snapSpanBoundaries(payload([span(98, 205)]), [], 5);
    expect(spansOf(result)[0]).toEqual(span(98, 205));
  });

  it("does nothing without tolerance", () => {
    const result = snapSpanBoundaries(payload([span(98, 205)]), BOUNDARIES, 0);
    expect(spansOf(result)[0]).toEqual(span(98, 205));
  });

  it("leaves moments and chapters untouched", () => {
    const result = snapSpanBoundaries(payload([span(98, 205)]), BOUNDARIES, 5);
    expect(result.moments[0].start_s).toBe(100.4);
    expect(result.chapters[0].start_s).toBe(0);
  });
});

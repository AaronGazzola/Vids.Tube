import { describe, expect, it } from "vitest";
import {
  laneCount,
  packThreadLanes,
  uncoveredStretches,
  type LaneSpan,
} from "@/lib/timeline-lanes";

type Thread = { title: string; score: number; spans: LaneSpan[] };

function thread(title: string, score: number, ...spans: [number, number][]): Thread {
  return {
    title,
    score,
    spans: spans.map(([start_s, end_s]) => ({ start_s, end_s })),
  };
}

const rank = (t: Thread) => t.score;

function laneOf(packed: { thread: Thread; lane: number }[], title: string): number {
  return packed.find((item) => item.thread.title === title)!.lane;
}

describe("packThreadLanes", () => {
  it("gives every thread its own lane, so a subject reads as one row", () => {
    const packed = packThreadLanes(
      [thread("a", 50, [0, 100], [400, 500]), thread("b", 40, [200, 300])],
      rank
    );
    expect(laneCount(packed)).toBe(2);
    expect(laneOf(packed, "a")).not.toBe(laneOf(packed, "b"));
  });

  it("keeps all of a thread's spans together on its lane", () => {
    const packed = packThreadLanes([thread("a", 50, [0, 100], [400, 500])], rank);
    expect(packed).toHaveLength(1);
    expect(packed[0].thread.spans).toHaveLength(2);
  });

  it("orders lanes by the chosen score, best at the top", () => {
    const packed = packThreadLanes(
      [thread("quiet", 10, [0, 10]), thread("loud", 90, [20, 30])],
      rank
    );
    expect(laneOf(packed, "loud")).toBe(0);
    expect(laneOf(packed, "quiet")).toBe(1);
  });

  it("breaks a score tie by which subject came first", () => {
    const packed = packThreadLanes(
      [thread("later", 50, [500, 600]), thread("earlier", 50, [10, 20])],
      rank
    );
    expect(laneOf(packed, "earlier")).toBe(0);
    expect(laneOf(packed, "later")).toBe(1);
  });

  it("puts two threads open at the same instant on different lanes", () => {
    const packed = packThreadLanes(
      [thread("outer", 60, [0, 600]), thread("inner", 50, [100, 200])],
      rank
    );
    expect(laneOf(packed, "outer")).not.toBe(laneOf(packed, "inner"));
  });

  it("counts no lanes for no threads", () => {
    expect(laneCount(packThreadLanes([], rank))).toBe(0);
  });
});

describe("uncoveredStretches", () => {
  const span = (start_s: number, end_s: number) => ({ start_s, end_s });

  it("reports the stretch before the first span", () => {
    expect(uncoveredStretches([span(100, 200)], 200)).toEqual([span(0, 100)]);
  });

  it("reports the stretch after the last span", () => {
    expect(uncoveredStretches([span(0, 100)], 200)).toEqual([span(100, 200)]);
  });

  it("reports a stretch between two spans", () => {
    expect(uncoveredStretches([span(0, 100), span(150, 200)], 200)).toEqual([
      span(100, 150),
    ]);
  });

  it("reports nothing when spans touch", () => {
    expect(uncoveredStretches([span(0, 100), span(100, 200)], 200)).toEqual([]);
  });

  it("reports nothing when spans overlap and cover everything", () => {
    expect(uncoveredStretches([span(0, 150), span(100, 200)], 200)).toEqual([]);
  });

  it("reports the whole stream when nothing is labelled", () => {
    expect(uncoveredStretches([], 200)).toEqual([span(0, 200)]);
  });

  it("ignores a span with no duration", () => {
    expect(uncoveredStretches([span(50, 50)], 100)).toEqual([span(0, 100)]);
  });

  it("clamps a span that runs past the stream", () => {
    expect(uncoveredStretches([span(0, 500)], 200)).toEqual([]);
  });

  it("reports nothing for a stream of no length", () => {
    expect(uncoveredStretches([span(0, 100)], 0)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { laneCount, packSectionLanes } from "@/lib/timeline-lanes";
import type { TimelineSection } from "@/lib/timeline.types";

const scores = { humour: 10, interest: 20, engagement: 30 };

function section(
  start_s: number,
  end_s: number | null,
  label: string
): TimelineSection {
  return { start_s, end_s, label, summary: "", tags: [], scores };
}

function laneOf(
  packed: { section: TimelineSection; lane: number }[],
  label: string
): number {
  return packed.find((item) => item.section.label === label)!.lane;
}

describe("packSectionLanes", () => {
  it("puts two disjoint sections on the same lane", () => {
    const packed = packSectionLanes(
      [section(0, 100, "a"), section(200, 300, "b")],
      600
    );
    expect(laneOf(packed, "a")).toBe(0);
    expect(laneOf(packed, "b")).toBe(0);
    expect(laneCount(packed)).toBe(1);
  });

  it("puts a nested section below its container", () => {
    const packed = packSectionLanes(
      [section(0, 2400, "debugging"), section(600, 960, "mustaches")],
      2400
    );
    expect(laneOf(packed, "debugging")).toBe(0);
    expect(laneOf(packed, "mustaches")).toBe(1);
  });

  it("gives the longest containing section the top lane regardless of input order", () => {
    const packed = packSectionLanes(
      [section(0, 360, "short"), section(0, 2400, "long")],
      2400
    );
    expect(laneOf(packed, "long")).toBe(0);
    expect(laneOf(packed, "short")).toBe(1);
  });

  it("spreads three mutually overlapping sections across three lanes", () => {
    const packed = packSectionLanes(
      [section(0, 300, "a"), section(100, 400, "b"), section(200, 500, "c")],
      600
    );
    expect(laneOf(packed, "a")).toBe(0);
    expect(laneOf(packed, "b")).toBe(1);
    expect(laneOf(packed, "c")).toBe(2);
    expect(laneCount(packed)).toBe(3);
  });

  it("reuses a freed lane once a section has ended", () => {
    const packed = packSectionLanes(
      [section(0, 300, "a"), section(100, 400, "b"), section(350, 500, "c")],
      600
    );
    expect(laneOf(packed, "c")).toBe(0);
    expect(laneCount(packed)).toBe(2);
  });

  it("treats a null end as running to the end of the stream", () => {
    const packed = packSectionLanes(
      [section(0, null, "open"), section(100, 200, "inside")],
      600
    );
    expect(laneOf(packed, "open")).toBe(0);
    expect(laneOf(packed, "inside")).toBe(1);
  });

  it("returns nothing for no sections", () => {
    const packed = packSectionLanes([], 600);
    expect(packed).toEqual([]);
    expect(laneCount(packed)).toBe(0);
  });
});

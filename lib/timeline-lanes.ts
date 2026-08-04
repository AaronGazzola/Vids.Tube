import type { TimelineSection } from "@/lib/timeline.types";

export type PackedSection<T extends TimelineSection = TimelineSection> = {
  section: T;
  lane: number;
};

export function packSectionLanes<T extends TimelineSection>(
  sections: T[],
  durationS: number
): PackedSection<T>[] {
  const endOf = (section: T) =>
    section.end_s === null ? durationS : section.end_s;

  const ordered = [...sections].sort((a, b) => {
    if (a.start_s !== b.start_s) {
      return a.start_s - b.start_s;
    }
    return endOf(b) - endOf(a);
  });

  const laneEnds: number[] = [];
  const packed: PackedSection<T>[] = [];

  for (const section of ordered) {
    let lane = laneEnds.findIndex((end) => end <= section.start_s);
    if (lane === -1) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = endOf(section);
    packed.push({ section, lane });
  }

  return packed;
}

export function laneCount(packed: PackedSection[]): number {
  return packed.reduce((max, item) => Math.max(max, item.lane + 1), 0);
}

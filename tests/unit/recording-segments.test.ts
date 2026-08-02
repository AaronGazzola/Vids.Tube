import { describe, expect, it } from "vitest";
import {
  BOUNDARY_TOLERANCE_SECONDS,
  parseSegmentEpoch,
  partitionSegments,
  readSegments,
  trimSeconds,
} from "@/lib/recording-segments";

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe("parseSegmentEpoch", () => {
  it("reads the moment recording began out of the filename", () => {
    expect(parseSegmentEpoch("/var/lib/vids-tube/rec/owner/2026-07-28_13-03-29-123456.mp4")).toBe(
      at("2026-07-28T13:03:29Z")
    );
  });

  it("reads a name with no fractional part", () => {
    expect(parseSegmentEpoch("2026-07-28_13-03-29.mp4")).toBe(at("2026-07-28T13:03:29Z"));
  });

  it("is not confused by dots in the directory path", () => {
    expect(parseSegmentEpoch("/srv/vids.tube/rec/owner/2026-07-28_13-03-29-1.mp4")).toBe(
      at("2026-07-28T13:03:29Z")
    );
  });

  it("returns nothing for a name that carries no timestamp", () => {
    expect(parseSegmentEpoch("/var/lib/vids-tube/rec/owner/leftover.mp4")).toBeNull();
    expect(parseSegmentEpoch("")).toBeNull();
  });
});

describe("readSegments", () => {
  it("sorts oldest first and reports what it could not read", () => {
    const { segments, unparseable } = readSegments([
      "2026-07-28_15-00-00-0.mp4",
      "notes.txt",
      "2026-07-28_13-03-29-0.mp4",
    ]);
    expect(segments.map((s) => s.path)).toEqual([
      "2026-07-28_13-03-29-0.mp4",
      "2026-07-28_15-00-00-0.mp4",
    ]);
    expect(unparseable).toEqual(["notes.txt"]);
  });

  it("gives an unreadable name no substitute time", () => {
    const { segments } = readSegments(["leftover.mp4"]);
    expect(segments).toHaveLength(0);
  });
});

describe("partitionSegments", () => {
  const startedAt = at("2026-07-28T13:03:29Z");

  it("separates an earlier broadcast's segments from this one's", () => {
    const { segments } = readSegments([
      "2026-07-26_12-22-53-0.mp4",
      "2026-07-28_13-03-29-0.mp4",
      "2026-07-28_14-10-00-0.mp4",
    ]);
    const { current, debris } = partitionSegments(segments, startedAt);
    expect(current.map((s) => s.path)).toEqual([
      "2026-07-28_13-03-29-0.mp4",
      "2026-07-28_14-10-00-0.mp4",
    ]);
    expect(debris.map((s) => s.path)).toEqual(["2026-07-26_12-22-53-0.mp4"]);
  });

  it("keeps a segment that began just before the encoder was recorded as connected", () => {
    const { segments } = readSegments(["2026-07-28_13-02-30-0.mp4"]);
    const { current, debris } = partitionSegments(segments, startedAt);
    expect(current).toHaveLength(1);
    expect(debris).toHaveLength(0);
  });

  it("treats a segment beyond the tolerance as debris", () => {
    const { segments } = readSegments(["2026-07-28_12-55-00-0.mp4"]);
    const { current, debris } = partitionSegments(segments, startedAt);
    expect(current).toHaveLength(0);
    expect(debris).toHaveLength(1);
  });

  it("uses a tolerance measured in minutes, not hours", () => {
    expect(BOUNDARY_TOLERANCE_SECONDS).toBeGreaterThan(0);
    expect(BOUNDARY_TOLERANCE_SECONDS).toBeLessThan(600);
  });

  it("returns nothing as current when every segment predates the broadcast", () => {
    const { segments } = readSegments(["2026-07-01_10-00-00-0.mp4"]);
    const { current } = partitionSegments(segments, startedAt);
    expect(current).toHaveLength(0);
  });
});

describe("trimSeconds", () => {
  it("trims the gap between recording start and going public", () => {
    expect(trimSeconds(at("2026-07-28T13:03:29Z"), at("2026-07-28T13:18:32Z"))).toBe(903);
  });

  it("trims nothing when the broadcast went public before recording began", () => {
    expect(trimSeconds(at("2026-07-28T13:18:32Z"), at("2026-07-28T13:03:29Z"))).toBe(0);
  });

  it("trims nothing when the two moments are the same", () => {
    const t = at("2026-07-28T13:03:29Z");
    expect(trimSeconds(t, t)).toBe(0);
  });
});

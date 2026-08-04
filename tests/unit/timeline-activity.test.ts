import { describe, expect, it } from "vitest";
import {
  chatActivitySeries,
  formatActivitySeries,
} from "@/lib/timeline-activity";
import type { ChatLine } from "@/lib/timeline.types";

function line(atS: number, author: string): ChatLine {
  return { atS, author, body: "hi" };
}

describe("chatActivitySeries", () => {
  it("returns an empty series for no messages", () => {
    expect(chatActivitySeries([], 60)).toEqual([]);
  });

  it("groups messages into buckets", () => {
    const series = chatActivitySeries(
      [line(0, "a"), line(10, "b"), line(70, "c")],
      60
    );
    expect(series).toEqual([
      { atS: 0, messages: 2, uniqueAuthors: 2 },
      { atS: 60, messages: 1, uniqueAuthors: 1 },
    ]);
  });

  it("puts a message exactly on a bucket edge in the later bucket", () => {
    const series = chatActivitySeries([line(60, "a")], 60);
    expect(series).toEqual([{ atS: 60, messages: 1, uniqueAuthors: 1 }]);
  });

  it("counts unique authors within a bucket", () => {
    const series = chatActivitySeries(
      [line(0, "a"), line(1, "a"), line(2, "b")],
      60
    );
    expect(series[0]).toEqual({ atS: 0, messages: 3, uniqueAuthors: 2 });
  });

  it("skips empty buckets rather than padding them", () => {
    const series = chatActivitySeries([line(0, "a"), line(600, "b")], 60);
    expect(series.map((bucket) => bucket.atS)).toEqual([0, 600]);
  });

  it("orders buckets by time regardless of input order", () => {
    const series = chatActivitySeries([line(600, "b"), line(0, "a")], 60);
    expect(series.map((bucket) => bucket.atS)).toEqual([0, 600]);
  });

  it("ignores messages with a negative or non-finite offset", () => {
    const series = chatActivitySeries(
      [line(-5, "a"), line(Number.NaN, "b"), line(10, "c")],
      60
    );
    expect(series).toEqual([{ atS: 0, messages: 1, uniqueAuthors: 1 }]);
  });
});

describe("formatActivitySeries", () => {
  it("renders one line per bucket", () => {
    const text = formatActivitySeries([
      { atS: 0, messages: 2, uniqueAuthors: 2 },
      { atS: 60, messages: 1, uniqueAuthors: 1 },
    ]);
    expect(text).toBe("0s: 2 messages, 2 chatters\n60s: 1 messages, 1 chatters");
  });

  it("states plainly when there was no activity", () => {
    expect(formatActivitySeries([])).toBe("(no chat activity recorded)");
  });
});

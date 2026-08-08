import { describe, expect, it } from "vitest";
import {
  fusedDuration,
  fusedToReal,
  realToFused,
  spanAfter,
  type FusedSpan,
} from "@/lib/fused-timeline";

const span = (startS: number, endS: number): FusedSpan => ({ startS, endS });

const TWO = [span(100, 200), span(500, 600)];

describe("fusedDuration", () => {
  it("adds up the spans and ignores the stream between them", () => {
    expect(fusedDuration(TWO)).toBe(200);
  });

  it("is zero for no spans", () => {
    expect(fusedDuration([])).toBe(0);
  });

  it("ignores a span with no duration", () => {
    expect(fusedDuration([span(10, 10), span(20, 30)])).toBe(10);
  });
});

describe("fusedToReal", () => {
  it("maps the start of the piece to the start of the first span", () => {
    expect(fusedToReal(TWO, 0)).toEqual({ realS: 100, index: 0 });
  });

  it("maps a position inside the first span", () => {
    expect(fusedToReal(TWO, 30)).toEqual({ realS: 130, index: 0 });
  });

  it("maps a position inside the second span", () => {
    expect(fusedToReal(TWO, 120)).toEqual({ realS: 520, index: 1 });
  });

  it("resolves a seam forward, into the next span", () => {
    expect(fusedToReal(TWO, 100)).toEqual({ realS: 500, index: 1 });
  });

  it("maps the very end of the piece to the end of the last span", () => {
    expect(fusedToReal(TWO, 200)).toEqual({ realS: 600, index: 1 });
  });

  it("returns nothing past the end of the piece", () => {
    expect(fusedToReal(TWO, 201)).toBeNull();
  });

  it("returns nothing for a negative position", () => {
    expect(fusedToReal(TWO, -1)).toBeNull();
  });

  it("returns nothing when there are no spans", () => {
    expect(fusedToReal([], 0)).toBeNull();
  });

  it("skips a span with no duration rather than trapping the playhead", () => {
    expect(fusedToReal([span(10, 10), span(20, 30)], 0)).toEqual({
      realS: 20,
      index: 0,
    });
  });

  it("treats a single span as the whole piece", () => {
    expect(fusedToReal([span(40, 50)], 5)).toEqual({ realS: 45, index: 0 });
  });
});

describe("realToFused", () => {
  it("maps a real time inside the first span", () => {
    expect(realToFused(TWO, 150)).toBe(50);
  });

  it("maps a real time inside the second span", () => {
    expect(realToFused(TWO, 550)).toBe(150);
  });

  it("returns nothing for a real time in the gap", () => {
    expect(realToFused(TWO, 300)).toBeNull();
  });

  it("returns nothing for a real time before the first span", () => {
    expect(realToFused(TWO, 50)).toBeNull();
  });

  it("returns nothing for a real time after the last span", () => {
    expect(realToFused(TWO, 700)).toBeNull();
  });

  it("returns nothing when there are no spans", () => {
    expect(realToFused([], 100)).toBeNull();
  });

  it("round-trips against fusedToReal", () => {
    for (const fused of [0, 25, 99, 100, 150, 200]) {
      const real = fusedToReal(TWO, fused)!;
      expect(realToFused(TWO, real.realS)).toBe(fused);
    }
  });
});

describe("spanAfter", () => {
  it("finds the span holding a real time", () => {
    expect(spanAfter(TWO, 150)).toBe(0);
  });

  it("finds the next span when the time is in a gap", () => {
    expect(spanAfter(TWO, 300)).toBe(1);
  });

  it("finds the first span when the time is before everything", () => {
    expect(spanAfter(TWO, 0)).toBe(0);
  });

  it("finds nothing past the last span", () => {
    expect(spanAfter(TWO, 700)).toBeNull();
  });
});

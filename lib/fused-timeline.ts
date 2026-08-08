// Fused time: an ordered set of spans played as one continuous piece with the
// stream time between them removed.
//
// This is the same structure a shorts renderer consumes — an ordered list of in/out
// pairs against one source — so it is built and tested here rather than invented
// twice. The player uses it to scrub a thread as a single piece.

export type FusedSpan = {
  startS: number;
  endS: number;
};

export type FusedPosition = {
  realS: number;
  index: number;
};

function usable(spans: FusedSpan[]): FusedSpan[] {
  return spans.filter((span) => span.endS > span.startS);
}

export function fusedDuration(spans: FusedSpan[]): number {
  return usable(spans).reduce((total, span) => total + (span.endS - span.startS), 0);
}

// A fused time exactly on a seam resolves to the START of the next span, so playback
// crossing a boundary lands in the next piece rather than on the last frame of the
// one it just left. The end of the whole piece is the one exception: there is no next
// span to move into.
export function fusedToReal(
  spans: FusedSpan[],
  fusedS: number
): FusedPosition | null {
  const usableSpans = usable(spans);
  if (usableSpans.length === 0 || fusedS < 0) {
    return null;
  }

  let consumed = 0;
  for (const [index, span] of usableSpans.entries()) {
    const length = span.endS - span.startS;
    const isLast = index === usableSpans.length - 1;
    const within = isLast ? fusedS <= consumed + length : fusedS < consumed + length;
    if (within) {
      return { realS: span.startS + (fusedS - consumed), index };
    }
    consumed += length;
  }
  return null;
}

// Null for a real time in a gap: that instant is genuinely not part of the fused
// piece, and whether to clamp forward or backward is the caller's decision — the map
// and the player want different answers.
export function realToFused(spans: FusedSpan[], realS: number): number | null {
  const usableSpans = usable(spans);
  let consumed = 0;
  for (const span of usableSpans) {
    if (realS >= span.startS && realS <= span.endS) {
      return consumed + (realS - span.startS);
    }
    consumed += span.endS - span.startS;
  }
  return null;
}

// The span holding a real time, or the next one after it when that time is in a gap.
// Used when playback has run past the end of a span.
export function spanAfter(spans: FusedSpan[], realS: number): number | null {
  const usableSpans = usable(spans);
  for (const [index, span] of usableSpans.entries()) {
    if (realS < span.endS) {
      return index;
    }
  }
  return null;
}

export type LaneSpan = {
  start_s: number;
  end_s: number;
};

export type LaneThread<S extends LaneSpan = LaneSpan> = {
  spans: S[];
};

export type PackedThread<T> = {
  thread: T;
  lane: number;
};

// A lane belongs to a thread, not to whatever bar happened to fit. Every appearance
// of a subject sits on the same row, so a recurring subject reads as one dashed line
// across the stream, and reading down a column at any instant shows everything open
// at that moment.
export function packThreadLanes<T extends LaneThread>(
  threads: T[],
  rank: (thread: T) => number
): PackedThread<T>[] {
  return [...threads]
    .sort((a, b) => {
      const byRank = rank(b) - rank(a);
      if (byRank !== 0) {
        return byRank;
      }
      return firstStart(a) - firstStart(b);
    })
    .map((thread, lane) => ({ thread, lane }));
}

function firstStart(thread: LaneThread): number {
  return thread.spans.reduce(
    (min, span) => Math.min(min, span.start_s),
    Number.POSITIVE_INFINITY
  );
}

export function laneCount(packed: PackedThread<unknown>[]): number {
  return packed.reduce((max, item) => Math.max(max, item.lane + 1), 0);
}

// The stretches no span occupies. These are the parts of the stream nothing will ever
// be made from, so they are the fastest read on whether the labelling missed
// something.
export function uncoveredStretches(
  spans: LaneSpan[],
  durationS: number
): LaneSpan[] {
  if (durationS <= 0) {
    return [];
  }
  const ordered = spans
    .filter((span) => span.end_s > span.start_s)
    .map((span) => ({
      start_s: Math.max(0, span.start_s),
      end_s: Math.min(durationS, span.end_s),
    }))
    .filter((span) => span.end_s > span.start_s)
    .sort((a, b) => a.start_s - b.start_s);

  const gaps: LaneSpan[] = [];
  let cursor = 0;
  for (const span of ordered) {
    if (span.start_s > cursor) {
      gaps.push({ start_s: cursor, end_s: span.start_s });
    }
    cursor = Math.max(cursor, span.end_s);
  }
  if (cursor < durationS) {
    gaps.push({ start_s: cursor, end_s: durationS });
  }
  return gaps;
}

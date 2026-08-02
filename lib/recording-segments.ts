// MediaMTX writes recordPath /var/lib/vids-tube/rec/%path/%Y-%m-%d_%H-%M-%S-%f,
// so every segment's filename carries the moment recording began. That is the
// only source that is actually the start: birth time is unsupported on the VM's
// filesystem and last-write time is the end of the recording, not its start.
export const BOUNDARY_TOLERANCE_SECONDS = 120;

export type Segment = {
  path: string;
  epoch: number;
};

const NAME = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(?:-(\d+))?/;

export function parseSegmentEpoch(path: string): number | null {
  const base = path.split(/[\\/]/).pop() ?? "";
  const m = NAME.exec(base);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac] = m;
  const ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s)
  );
  if (!Number.isFinite(ms)) return null;
  const fraction = frac ? Number(`0.${frac}`) : 0;
  return Math.floor(ms / 1000 + fraction);
}

export function readSegments(paths: string[]): {
  segments: Segment[];
  unparseable: string[];
} {
  const segments: Segment[] = [];
  const unparseable: string[] = [];
  for (const path of paths) {
    const epoch = parseSegmentEpoch(path);
    if (epoch === null) {
      unparseable.push(path);
      continue;
    }
    segments.push({ path, epoch });
  }
  segments.sort((a, b) => a.epoch - b.epoch);
  return { segments, unparseable };
}

// The recorder starts writing a moment before the app records the encoder as
// connected, so the boundary is generous enough not to classify a broadcast's
// own first segment as debris, and far smaller than the gap between two
// broadcasts.
export function partitionSegments(
  segments: Segment[],
  startedAtEpoch: number,
  toleranceSeconds: number = BOUNDARY_TOLERANCE_SECONDS
): { current: Segment[]; debris: Segment[] } {
  const boundary = startedAtEpoch - toleranceSeconds;
  const current: Segment[] = [];
  const debris: Segment[] = [];
  for (const s of segments) {
    if (s.epoch >= boundary) current.push(s);
    else debris.push(s);
  }
  return { current, debris };
}

export function trimSeconds(
  firstSegmentEpoch: number,
  liveAtEpoch: number
): number {
  const delta = liveAtEpoch - firstSegmentEpoch;
  return delta > 0 ? delta : 0;
}

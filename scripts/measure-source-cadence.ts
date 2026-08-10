import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function targetDurationFrom(playlist: string): number | null {
  const match = playlist.match(/#EXT-X-TARGETDURATION:\s*([\d.]+)/);
  return match ? Number(match[1]) : null;
}

function segmentDurationsFrom(playlist: string): number[] {
  return [...playlist.matchAll(/#EXTINF:\s*([\d.]+)/g)].map((m) => Number(m[1]));
}

async function keyframeTimes(source: string, seconds: number): Promise<number[]> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-skip_frame",
      "nokey",
      "-show_entries",
      "frame=pts_time",
      "-of",
      "csv=p=0",
      "-read_intervals",
      `%+${seconds}`,
      source,
    ],
    { maxBuffer: 1024 * 1024 * 16 }
  );
  return stdout
    .split("\n")
    .map((line) => Number(line.trim()))
    .filter((value) => Number.isFinite(value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

async function main() {
  const source = flag("--source");
  if (!source) {
    console.error(
      "usage: measure-source-cadence --source <hls url, rtmp url or file> [--window 30]"
    );
    process.exit(2);
    return;
  }
  const window = Number(flag("--window") ?? 30);

  let segmentDuration: number | null = null;
  if (source.endsWith(".m3u8")) {
    const response = await fetch(source);
    if (!response.ok) {
      console.error(`could not read the playlist at ${source}: ${response.status}`);
      process.exit(1);
      return;
    }
    const playlist = await response.text();
    const durations = segmentDurationsFrom(playlist);
    segmentDuration = durations.length
      ? median(durations)
      : targetDurationFrom(playlist);
  }

  const times = await keyframeTimes(source, window);
  if (times.length < 3) {
    console.error(
      `only ${times.length} keyframes found in the first ${window}s; cannot measure a cadence`
    );
    process.exit(1);
    return;
  }

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push(times[i] - times[i - 1]);
  }
  const keyframeInterval = median(gaps);
  const spread = Math.max(...gaps) - Math.min(...gaps);

  console.log(`keyframes measured: ${times.length}`);
  console.log(`keyframe interval:  ${keyframeInterval.toFixed(3)}s`);
  console.log(`interval spread:    ${spread.toFixed(3)}s`);
  if (segmentDuration !== null) {
    console.log(`segment duration:   ${segmentDuration.toFixed(3)}s`);
  }

  if (segmentDuration !== null) {
    const ratio = segmentDuration / keyframeInterval;
    const whole = Math.abs(ratio - Math.round(ratio)) < 0.05;
    if (!whole) {
      console.error(
        `segments cannot align: a segment duration of ${segmentDuration.toFixed(
          3
        )}s is not a whole multiple of a keyframe interval of ${keyframeInterval.toFixed(
          3
        )}s`
      );
      process.exit(1);
      return;
    }
  }

  const frameRate = Number(flag("--fps") ?? 30);
  console.log(`use -g ${Math.round(keyframeInterval * frameRate)} for the rungs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

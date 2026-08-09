// Fetches a YouTube caption track for one video, by video id alone.
//
// The back-catalogue backfill walks `youtube_vods`, which holds imported VODs.
// A live-captured broadcast is not in that table, so its own YouTube copy could
// not be reached by any existing path.
import { execFile } from "child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const YTDLP = process.env.YTDLP_BIN ?? "yt-dlp";

export type CaptionSegment = { startS: number; text: string };

type Json3Event = {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: { utf8?: string }[];
  aAppend?: number;
};

function parseJson3(path: string): CaptionSegment[] {
  const doc = JSON.parse(readFileSync(path, "utf8")) as {
    events?: Json3Event[];
  };
  const rows: CaptionSegment[] = [];
  for (const ev of doc.events ?? []) {
    if (ev.tStartMs === undefined || !ev.segs || ev.aAppend) continue;
    const text = ev.segs
      .map((s) => s.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    rows.push({ startS: ev.tStartMs / 1000, text });
  }
  return rows;
}

// Caption events are a word or two each, which is too short to fingerprint.
// Grouping them into spans of roughly a sentence gives each one enough words to
// be identifiable.
export function groupCaptions(
  segments: CaptionSegment[],
  windowS = 20
): CaptionSegment[] {
  const grouped: CaptionSegment[] = [];
  for (const seg of segments) {
    const last = grouped[grouped.length - 1];
    if (last && seg.startS - last.startS < windowS) {
      last.text = `${last.text} ${seg.text}`;
    } else {
      grouped.push({ startS: seg.startS, text: seg.text });
    }
  }
  return grouped;
}

export async function fetchCaptions(
  videoId: string
): Promise<CaptionSegment[]> {
  const tmp = mkdtempSync(join(tmpdir(), "yt-captions-"));
  try {
    await execFileAsync(
      YTDLP,
      [
        "--skip-download",
        "--write-auto-subs",
        "--write-subs",
        "--sub-langs",
        "en.*,en",
        "--sub-format",
        "json3",
        "--no-warnings",
        "-o",
        join(tmp, videoId),
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { maxBuffer: 1024 * 1024 * 64 }
    );
    const file = readdirSync(tmp).find((f) => f.endsWith(".json3"));
    if (!file) return [];
    return parseJson3(join(tmp, file));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

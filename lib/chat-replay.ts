import type { ChatReplay, ReplayGap, ReplayMessage } from "@/app/watch/[videoId]/page.types";

type NormalizedGap = { startMs: number; endMs: number };

function normalizeGaps(gaps: ReplayGap[], baseMs: number): NormalizedGap[] {
  return gaps
    .map((g) => ({
      startMs: new Date(g.startAt).getTime(),
      endMs: g.endAt ? new Date(g.endAt).getTime() : new Date(g.startAt).getTime(),
    }))
    .filter((g) => Number.isFinite(g.startMs) && g.endMs >= g.startMs && g.startMs >= baseMs)
    .sort((a, b) => a.startMs - b.startMs);
}

// Convert a message's wall-clock time to its position in the VOD timeline. The VOD
// concatenates only recorded (connected) footage, so each reconnect gap is removed:
// time after a gap shifts earlier by the gap's duration, and a message sent during a
// gap is clamped to that gap's cut point (so all in-gap messages reveal together the
// instant the video jumps).
export function messageVideoMs(
  createdMs: number,
  baseMs: number,
  gaps: NormalizedGap[]
): number {
  let removed = 0;
  for (const g of gaps) {
    if (createdMs >= g.endMs) {
      removed += g.endMs - g.startMs;
    } else if (createdMs >= g.startMs) {
      // Inside this gap: clamp to the cut (the gap's start), minus earlier gaps.
      return Math.max(0, g.startMs - baseMs - removed);
    } else {
      break;
    }
  }
  return Math.max(0, createdMs - baseMs - removed);
}

export function toReplayMessages(data: ChatReplay): ReplayMessage[] {
  if (data.messages.length === 0) {
    return [];
  }
  // Anchor to live_at (the VOD start); fall back to started_at (legacy), then to
  // the first message. Gap adjustment only applies when live_at is known.
  const liveMs = data.liveAt ? new Date(data.liveAt).getTime() : NaN;
  const startedMs = data.startedAt ? new Date(data.startedAt).getTime() : NaN;
  const baseMs = Number.isFinite(liveMs)
    ? liveMs
    : Number.isFinite(startedMs)
      ? startedMs
      : new Date(data.messages[0].created_at).getTime();

  const gaps = Number.isFinite(liveMs)
    ? normalizeGaps(data.gaps, baseMs)
    : [];

  return data.messages.map((m) => ({
    id: m.id,
    userId: m.user_id,
    origin: m.origin,
    author: m.author,
    author_name: m.author_name,
    author_avatar_url: m.author_avatar_url,
    body: m.body,
    offsetMs: messageVideoMs(new Date(m.created_at).getTime(), baseMs, gaps),
  }));
}

export function visibleReplayMessages(
  messages: ReplayMessage[],
  currentTimeMs: number
): ReplayMessage[] {
  return messages.filter((m) => m.offsetMs <= currentTimeMs);
}

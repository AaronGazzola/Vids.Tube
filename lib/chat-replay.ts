import type { ChatReplay, ReplayMessage } from "@/app/watch/[videoId]/page.types";

export function toReplayMessages(data: ChatReplay): ReplayMessage[] {
  if (data.messages.length === 0) {
    return [];
  }
  const explicitStart = data.startedAt
    ? new Date(data.startedAt).getTime()
    : NaN;
  const baseMs = Number.isFinite(explicitStart)
    ? explicitStart
    : new Date(data.messages[0].created_at).getTime();

  return data.messages.map((m) => ({
    id: m.id,
    userId: m.user_id,
    origin: m.origin,
    author: m.author,
    author_name: m.author_name,
    author_avatar_url: m.author_avatar_url,
    body: m.body,
    offsetMs: Math.max(0, new Date(m.created_at).getTime() - baseMs),
  }));
}

export function visibleReplayMessages(
  messages: ReplayMessage[],
  currentTimeMs: number
): ReplayMessage[] {
  return messages.filter((m) => m.offsetMs <= currentTimeMs);
}

export const MAX_BATCH_SIZE = 25;

export type ScorableMessage = {
  id: string;
  origin: string;
  userId: string | null;
  externalAuthorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
};

export type TranscriptSegment = {
  start_s: number;
  end_s: number;
  text: string;
};

export function eligibleForScoring(
  messages: ScorableMessage[],
  hostUserId: string | null
): ScorableMessage[] {
  return messages.filter((m) => {
    if (m.origin === "bot") return false;
    if (hostUserId && m.userId === hostUserId) return false;
    return true;
  });
}

export function batchMessages(
  messages: ScorableMessage[],
  size: number = MAX_BATCH_SIZE
): ScorableMessage[][] {
  const batches: ScorableMessage[][] = [];
  for (let i = 0; i < messages.length; i += size) {
    batches.push(messages.slice(i, i + size));
  }
  return batches;
}

// A message is rated against what the streamer was saying at the time, so each
// batch gets the transcript spanning its own first and last message rather than
// the whole broadcast.
export function transcriptWindow(
  segments: TranscriptSegment[],
  batch: ScorableMessage[],
  broadcastStart: string,
  paddingSeconds = 60
): string {
  if (!segments.length || !batch.length) return "";
  const base = new Date(broadcastStart).getTime();
  const first = (new Date(batch[0].createdAt).getTime() - base) / 1000;
  const last = (new Date(batch[batch.length - 1].createdAt).getTime() - base) / 1000;
  const from = first - paddingSeconds;
  const to = last + paddingSeconds;
  return segments
    .filter((s) => s.end_s >= from && s.start_s <= to)
    .map((s) => s.text)
    .join(" ")
    .trim();
}

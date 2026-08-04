// Chatter totals come from stored chat and nothing else. The old path added a
// pre-aggregated summary of the YouTube archive to a raw count of stored chat,
// reconciled by a timestamp watermark that only protected one of the two. Before
// a chatter linked their YouTube account the branches did not overlap, because
// imported rows carried no user id; after the identity merge attached their user
// to those same rows, both branches counted them. Claiming inflated your own
// totals.
//
// Counting once, from one place, means linking cannot change the numbers.

export type ChatRow = {
  streamId: string;
  createdAt: string;
  userId: string | null;
  externalAuthorId: string | null;
};

export type ChatterIdentity = {
  userId: string | null;
  youtubeChannelId: string | null;
};

export type ChatterTotals = {
  totalMessages: number;
  videosAttended: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export function matchesIdentity(row: ChatRow, identity: ChatterIdentity): boolean {
  if (identity.userId && row.userId === identity.userId) return true;
  if (identity.youtubeChannelId && row.externalAuthorId === identity.youtubeChannelId) {
    return true;
  }
  return false;
}

export function summariseChat(
  rows: ChatRow[],
  identity: ChatterIdentity
): ChatterTotals {
  const mine = rows.filter((r) => matchesIdentity(r, identity));
  const streams = new Set(mine.map((r) => r.streamId));
  let firstSeenAt: string | null = null;
  let lastSeenAt: string | null = null;
  for (const r of mine) {
    if (!firstSeenAt || r.createdAt < firstSeenAt) firstSeenAt = r.createdAt;
    if (!lastSeenAt || r.createdAt > lastSeenAt) lastSeenAt = r.createdAt;
  }
  return {
    totalMessages: mine.length,
    videosAttended: streams.size,
    firstSeenAt,
    lastSeenAt,
  };
}

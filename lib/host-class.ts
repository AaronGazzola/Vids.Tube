// The streamer is a fourth participant class alongside viewer, bot and system:
// present in chat, never scored, holding no membership and no chatter channel,
// but keeping commands with elevated rights.
export type ChatParticipant = {
  origin: string;
  externalAuthorId: string | null;
  isBot?: boolean;
};

export function isHostMessage(
  m: ChatParticipant,
  hostChannelId: string | null
): boolean {
  if (m.isBot) return false;
  if (!hostChannelId) return false;
  return m.externalAuthorId === hostChannelId;
}

export function scorableOnly<T extends { isHost?: boolean }>(batch: T[]): T[] {
  return batch.filter((m) => !m.isHost);
}

// Detection order: the account recorded on the broadcast itself, then the one on
// the community channel for broadcasts that predate that field being written.
// Auto-detection only ever suppresses scoring; it never marks a YouTube link
// verified, because appearing in a broadcast proves nothing about controlling
// the account.
export function pickHostChannelId(
  streamYoutubeChannelId: string | null,
  communityYoutubeChannelId: string | null
): string | null {
  return streamYoutubeChannelId ?? communityYoutubeChannelId ?? null;
}

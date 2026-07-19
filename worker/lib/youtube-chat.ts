import type { YouTubeChatMessage } from "@/app/layout.types";
import { fetchLiveChatPage, fetchVideoData } from "@/lib/youtube";
import { workerConfig } from "../config";

export type YoutubeChatMessage = YouTubeChatMessage & { origin: "youtube" };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveLiveChatId(
  youtubeVideoId: string | null
): Promise<string | null> {
  if (!youtubeVideoId) {
    return null;
  }
  const video = await fetchVideoData(youtubeVideoId);
  return video.activeLiveChatId;
}

// The bot's own YouTube sends come back through the poller as the Nightbot
// account; they must never be persisted, scored, or command-processed.
function isNightbot(m: YouTubeChatMessage): boolean {
  const nightbotChannelId = process.env.NIGHTBOT_YOUTUBE_CHANNEL_ID;
  if (nightbotChannelId && m.authorChannelId === nightbotChannelId) {
    return true;
  }
  return m.author === "Nightbot";
}

export async function* pollYoutubeChat(
  liveChatId: string | null
): AsyncGenerator<YoutubeChatMessage> {
  if (!liveChatId) {
    return;
  }
  let pageToken: string | undefined;
  for (;;) {
    const page = await fetchLiveChatPage(liveChatId, pageToken);
    for (const m of page.messages) {
      if (isNightbot(m)) {
        continue;
      }
      yield { ...m, origin: "youtube" };
    }
    if (!page.nextPageToken) {
      return;
    }
    pageToken = page.nextPageToken;
    await sleep(
      Math.max(1000, workerConfig.youtubeChatPollMs, page.pollingIntervalMillis)
    );
  }
}

import type { YouTubeChatMessage } from "@/app/layout.types";
import { fetchLiveChatPage, fetchVideoData } from "@/lib/youtube";
import { workerConfig } from "../config";

export type YoutubeChatMessage = YouTubeChatMessage & {
  origin: "youtube";
  isBot: boolean;
};

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

// Nightbot messages are shown in Vids.Tube chat (as origin "bot") but must
// never be scored or command-processed.
function isNightbot(m: YouTubeChatMessage): boolean {
  const nightbotChannelId = process.env.NIGHTBOT_YOUTUBE_CHANNEL_ID;
  if (nightbotChannelId && m.authorChannelId === nightbotChannelId) {
    return true;
  }
  return m.author.replace(/^@+/, "").toLowerCase() === "nightbot";
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
      yield { ...m, origin: "youtube", isBot: isNightbot(m) };
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

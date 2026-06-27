import type { YouTubeChatMessage } from "@/app/layout.types";
import { fetchLiveChatPage, fetchVideoData } from "@/lib/youtube";

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
      yield { ...m, origin: "youtube" };
    }
    if (!page.nextPageToken) {
      return;
    }
    pageToken = page.nextPageToken;
    await sleep(Math.max(1000, page.pollingIntervalMillis));
  }
}

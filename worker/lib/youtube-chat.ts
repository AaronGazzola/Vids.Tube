import type { YouTubeChatMessage, YouTubeChatPage } from "@/app/layout.types";
import { fetchLiveChatPage, fetchVideoData, YouTubeApiError } from "@/lib/youtube";
import { workerConfig } from "../config";

export type YoutubeChatMessage = YouTubeChatMessage & {
  origin: "youtube";
  isBot: boolean;
};

export type PollOptions = {
  // Checked while waiting between pages, not only when a message arrives. The
  // scoring job awaits this poller before releasing the broadcast, so a chat
  // that goes silent would otherwise hold the worker open indefinitely.
  shouldStop: () => boolean;
  // Called after every successful read, before its messages are yielded, so the
  // caller can record that the reader is alive whether or not anyone spoke.
  onPage?: () => void;
};

const BACKOFF_MIN_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;

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

// The chat is over and no amount of retrying brings it back. Everything else,
// quota exhaustion included, is transient: those retries are futile until the
// quota resets, but they are harmless, and the capture indicator reporting the
// reader as stale is the true state and better than a silent stop.
export function isChatEnded(e: unknown): boolean {
  if (!(e instanceof YouTubeApiError)) {
    return false;
  }
  if (e.status === 404) {
    return true;
  }
  return e.reason === "liveChatEnded" || e.reason === "liveChatNotFound";
}

export async function* pollYoutubeChat(
  liveChatId: string | null,
  opts: PollOptions
): AsyncGenerator<YoutubeChatMessage> {
  if (!liveChatId) {
    return;
  }
  let pageToken: string | undefined;
  let backoff = BACKOFF_MIN_MS;
  for (;;) {
    if (opts.shouldStop()) {
      return;
    }

    let page: YouTubeChatPage;
    try {
      page = await fetchLiveChatPage(liveChatId, pageToken);
    } catch (e) {
      if (isChatEnded(e)) {
        return;
      }
      // Retried with the token already held, so pages resume where they
      // stopped. A fresh request with no token returns only recent messages,
      // which would drop everything that arrived during the outage.
      console.error(`[chat:yt] page read failed, retrying in ${backoff}ms:`, e);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
      continue;
    }

    backoff = BACKOFF_MIN_MS;
    opts.onPage?.();
    for (const m of page.messages) {
      yield { ...m, origin: "youtube", isBot: isNightbot(m) };
    }

    // A running chat returns a next token on every page. Its absence is an
    // anomaly rather than an announcement, so the existing token is kept and
    // the same place is asked for again. A chat that has truly ended arrives as
    // one of the terminal reasons above.
    if (page.nextPageToken) {
      pageToken = page.nextPageToken;
    }

    await sleep(
      Math.max(1000, workerConfig.youtubeChatPollMs, page.pollingIntervalMillis)
    );
    if (opts.shouldStop()) {
      return;
    }
  }
}

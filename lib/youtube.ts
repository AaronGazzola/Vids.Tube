import type {
  YouTubeChatPage,
  YouTubeVideoData,
} from "@/app/layout.types";

const API = "https://www.googleapis.com/youtube/v3";

function key(): string {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) {
    throw new Error("YOUTUBE_API_KEY is not set");
  }
  return k;
}

export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) {
    return s;
  }
  try {
    const url = new URL(s);
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
      return v;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[a-zA-Z0-9_-]{11}$/.test(last)) {
      return last;
    }
  } catch {
    return null;
  }
  return null;
}

export async function fetchVideoData(
  videoId: string
): Promise<YouTubeVideoData> {
  const url = `${API}/videos?part=statistics,liveStreamingDetails,snippet&id=${videoId}&key=${key()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `YouTube videos.list failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    throw new Error(`No video found for id "${videoId}"`);
  }
  return {
    likeCount: Number(item.statistics?.likeCount ?? 0),
    concurrentViewers: Number(
      item.liveStreamingDetails?.concurrentViewers ?? 0
    ),
    channelId: item.snippet?.channelId ?? "",
    activeLiveChatId: item.liveStreamingDetails?.activeLiveChatId ?? null,
    liveBroadcastContent: item.snippet?.liveBroadcastContent ?? "none",
    title: item.snippet?.title ?? "",
  };
}

export async function fetchSubs(channelId: string): Promise<number> {
  if (!channelId) {
    return 0;
  }
  const url = `${API}/channels?part=statistics&id=${channelId}&key=${key()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `YouTube channels.list failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  const item = data.items?.[0];
  return Number(item?.statistics?.subscriberCount ?? 0);
}

export async function fetchLiveChatPage(
  liveChatId: string,
  pageToken?: string
): Promise<YouTubeChatPage> {
  const params = new URLSearchParams({
    liveChatId,
    part: "snippet,authorDetails",
    key: key(),
  });
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const res = await fetch(`${API}/liveChat/messages?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `YouTube liveChatMessages.list failed: ${res.status} ${await res.text()}`
    );
  }
  const data = await res.json();
  const messages = (data.items ?? []).map(
    (it: {
      snippet?: { displayMessage?: string; publishedAt?: string };
      authorDetails?: { displayName?: string; channelId?: string };
    }) => ({
      author: it.authorDetails?.displayName ?? "",
      authorChannelId: it.authorDetails?.channelId ?? "",
      text: it.snippet?.displayMessage ?? "",
      publishedAt: it.snippet?.publishedAt ?? "",
    })
  );
  return {
    messages,
    nextPageToken: data.nextPageToken ?? null,
    pollingIntervalMillis: Number(data.pollingIntervalMillis ?? 5000),
  };
}

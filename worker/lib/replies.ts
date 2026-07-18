import {
  forceNightbotRefresh,
  getNightbotToken,
  nightbotConfigured,
} from "./nightbot-token";

const NIGHTBOT_SEND_URL = "https://api.nightbot.tv/1/channel/send";
const MAX_YOUTUBE_CHARS = 400;

export type ReplyDelivery = {
  streamId: string;
  origin: "vidstube" | "youtube" | "bot";
  text: string;
};

export function truncateForYoutube(text: string): string {
  if (text.length <= MAX_YOUTUBE_CHARS) {
    return text;
  }
  const slice = text.slice(0, MAX_YOUTUBE_CHARS - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > MAX_YOUTUBE_CHARS / 2 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

function sendSpacingMs(): number {
  const raw = Number(process.env.NIGHTBOT_SEND_SPACING_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 5200;
}

type NightbotSender = (text: string, token: string) => Promise<Response>;
type NightbotTokenFn = () => Promise<string | null>;

const defaultSender: NightbotSender = (text, token) =>
  fetch(NIGHTBOT_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ message: text }).toString(),
  });

const BRIDGE_MAX_QUEUE = 5;

const queue: string[] = [];
const bridgeQueue: string[] = [];
let bridgeDropped = 0;
let draining = false;
let warnedMissingToken = false;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function drainQueue(
  sender: NightbotSender,
  wait: typeof sleep,
  tokenFn: NightbotTokenFn,
  refreshFn: NightbotTokenFn
) {
  if (draining) {
    return;
  }
  draining = true;
  try {
    while (queue.length || bridgeQueue.length) {
      const text = (queue.length ? queue.shift() : bridgeQueue.shift())!;
      try {
        let token = await tokenFn();
        if (!token) {
          console.error("nightbot token unavailable — dropping YouTube reply");
          continue;
        }
        let res = await sender(text, token);
        if (res.status === 401) {
          const fresh = await refreshFn();
          if (fresh && fresh !== token) {
            token = fresh;
            res = await sender(text, token);
          }
        }
        if (res.status === 429) {
          await wait(sendSpacingMs());
          const retry = await sender(text, token);
          if (!retry.ok) {
            console.error(
              `nightbot send retry failed (${retry.status}): ${await retry.text()}`
            );
          }
        } else if (!res.ok) {
          console.error(
            `nightbot send failed (${res.status}): ${await res.text()}`
          );
        }
      } catch (e) {
        console.error("nightbot send error:", e);
      }
      if (queue.length || bridgeQueue.length) {
        await wait(sendSpacingMs());
      }
    }
  } finally {
    draining = false;
  }
}

export function enqueueNightbotSend(
  text: string,
  sender: NightbotSender = defaultSender,
  wait: typeof sleep = sleep,
  tokenFn: NightbotTokenFn = getNightbotToken,
  refreshFn: NightbotTokenFn = forceNightbotRefresh
): void {
  if (!nightbotConfigured()) {
    if (!warnedMissingToken) {
      warnedMissingToken = true;
      console.error(
        "Nightbot is not configured (no token or refresh credentials) — skipping YouTube replies"
      );
    }
    return;
  }
  queue.push(truncateForYoutube(text));
  void drainQueue(sender, wait, tokenFn, refreshFn);
}

export function enqueueNightbotBridge(
  text: string,
  sender: NightbotSender = defaultSender,
  wait: typeof sleep = sleep,
  tokenFn: NightbotTokenFn = getNightbotToken,
  refreshFn: NightbotTokenFn = forceNightbotRefresh
): void {
  if (!nightbotConfigured()) {
    return;
  }
  bridgeQueue.push(truncateForYoutube(text));
  while (bridgeQueue.length > BRIDGE_MAX_QUEUE) {
    bridgeQueue.shift();
    bridgeDropped += 1;
    console.error(
      `nightbot bridge queue full — dropped oldest (total dropped: ${bridgeDropped})`
    );
  }
  void drainQueue(sender, wait, tokenFn, refreshFn);
}

export async function deliverReply(delivery: ReplyDelivery): Promise<void> {
  if (delivery.origin === "youtube") {
    enqueueNightbotSend(delivery.text);
    return;
  }
  // Imported lazily so pure helpers (truncation, queue) stay testable without
  // Supabase env configured.
  const { supabaseAdmin } = await import("../supabase");
  const { error } = await supabaseAdmin.from("chat_messages").insert({
    stream_id: delivery.streamId,
    origin: "bot",
    user_id: null,
    author_name: "VidsBot",
    body: delivery.text,
  });
  if (error) {
    console.error("vidsbot reply insert failed:", error);
  }
}

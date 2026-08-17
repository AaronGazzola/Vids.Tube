import type { OverlayEvent } from "@/lib/overlay-events";
import type { OverlaySettings } from "@/lib/overlay-settings";

// A page receives every frame's messages on the same listener, so the namespace
// is checked before anything else. The version is present from the first message
// so a second one can exist without anybody having to guess what an unversioned
// message meant.
//
// The namespace key is `ns` and not `channel`, because on this platform a channel
// is a streamer's channel and nothing else. The first version of this protocol
// used `channel` for both, and the namespace silently overwrote the channel id in
// every `hello`.
export const OVERLAY_MESSAGE_NS = "vidstube-overlay";
export const OVERLAY_MESSAGE_VERSION = 1;

export type OverlayBoxSize = {
  width: number;
  height: number;
  scale: number;
};

// An overlay that breaks is supposed to become invisible, which makes a broken overlay and an idle one
// look identical from the stream. This is how the difference is told: the frame says what threw, and
// where, before it goes quiet.
export type OverlayFrameMessage =
  | { type: "ready" }
  | { type: "error"; where: string; message: string; stack: string };

export type OverlayHostMessage =
  | {
      type: "hello";
      channel: string;
      settings: OverlaySettings;
      box: OverlayBoxSize;
    }
  | { type: "settings"; settings: OverlaySettings }
  | { type: "box"; box: OverlayBoxSize }
  | { type: "event"; event: OverlayEvent };

export type OverlayMessage = OverlayFrameMessage | OverlayHostMessage;

const HOST_TYPES = new Set(["hello", "settings", "box", "event"]);
const FRAME_TYPES = new Set(["ready", "error"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function overlayMessage<T extends OverlayMessage>(
  message: T
): T & { ns: string; v: number } {
  return {
    ...message,
    ns: OVERLAY_MESSAGE_NS,
    v: OVERLAY_MESSAGE_VERSION,
  };
}

// Returns null for anything not addressed to this protocol, including a version
// it does not understand: guessing at a future message is how a protocol stops
// being able to change.
export function parseOverlayMessage(data: unknown): OverlayMessage | null {
  if (!isRecord(data)) {
    return null;
  }
  if (data.ns !== OVERLAY_MESSAGE_NS) {
    return null;
  }
  if (data.v !== OVERLAY_MESSAGE_VERSION) {
    return null;
  }
  const type = data.type;
  if (typeof type !== "string") {
    return null;
  }
  if (!HOST_TYPES.has(type) && !FRAME_TYPES.has(type)) {
    return null;
  }
  return data as unknown as OverlayMessage;
}

export function sameBox(
  a: OverlayBoxSize | null,
  b: OverlayBoxSize | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.width === b.width && a.height === b.height && a.scale === b.scale;
}

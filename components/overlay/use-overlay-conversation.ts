"use client";

import {
  overlayMessage,
  parseOverlayMessage,
  sameBox,
  type OverlayBoxSize,
  type OverlayHostMessage,
} from "@/lib/overlay-messages";
import type { OverlayEvent } from "@/lib/overlay-events";
import type { OverlaySettings } from "@/lib/overlay-settings";
import { useEffect, useRef } from "react";

function originOf(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

// The host end of the conversation with a framed overlay.
//
// The frame speaks first, because the host cannot know when someone else's script
// has finished loading. Everything the host holds is sent in the answer, so a
// frame is never left assembling its state from a sequence of updates it may have
// joined halfway through.
//
// A frame that never announces itself is left entirely alone. That is not a
// failure state: it is every overlay written before this protocol existed.
export function useOverlayConversation({
  frameRef,
  permittedOrigin,
  channelId,
  settings,
  box,
  events = [],
}: {
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  permittedOrigin: string;
  channelId: string | null;
  settings: OverlaySettings | null;
  box: OverlayBoxSize;
  events?: OverlayEvent[];
}) {
  const ready = useRef(false);
  const sentSettings = useRef<string | null>(null);
  const sentBox = useRef<OverlayBoxSize | null>(null);
  // By id rather than by timestamp, so an effect that re-runs cannot deliver a
  // chatter's action twice. Pruned, because a stream runs for hours.
  const sentEvents = useRef<Set<string>>(new Set());

  const origin = originOf(permittedOrigin);
  // Serialised so that a poll returning an equal object does not read as a
  // change and re-send. The route refetches every fifteen seconds.
  const settingsKey = JSON.stringify(settings ?? null);
  const boxKey = `${box.width}|${box.height}|${box.scale}`;
  const eventsKey = events.map((e) => e.id).join(",");

  useEffect(() => {
    if (!origin || !channelId) return;

    const post = (message: OverlayHostMessage) => {
      const target = frameRef.current?.contentWindow;
      if (!target) return;
      // Never a wildcard: this names the one origin allowed to be framed.
      target.postMessage(overlayMessage(message), origin);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      // Origin alone is not enough. Any document on that origin could otherwise
      // address this page; only the frame this component rendered may.
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      const message = parseOverlayMessage(event.data);
      if (!message) return;

      // Reported, not acted on. A frame that throws once is not necessarily a frame that stopped
      // working, and hiding it would turn a stray rejection into a dead overlay for the rest of the
      // stream. The frame renders nothing when it fails, so there is nothing left to hide.
      if (message.type === "error") {
        console.error(
          `overlay frame error (${message.where}) on channel ${channelId}: ${message.message}`,
          message.stack
        );
        return;
      }
      if (message.type !== "ready") return;

      ready.current = true;
      sentSettings.current = settingsKey;
      sentBox.current = box;
      // Anything that happened before the frame was listening stays unsent. The
      // announcement begins the conversation; it does not replay it.
      for (const event of events) sentEvents.current.add(event.id);
      post({
        type: "hello",
        channel: channelId,
        settings: settings ?? {},
        box,
      });
    };

    window.addEventListener("message", onMessage);

    // A frame that announced itself before this listener was attached, or before
    // the settings arrived, is answered again rather than stranded until the next
    // edit.
    if (ready.current) {
      if (sentSettings.current !== settingsKey) {
        sentSettings.current = settingsKey;
        post({ type: "settings", settings: settings ?? {} });
      }
      if (!sameBox(sentBox.current, box)) {
        sentBox.current = box;
        post({ type: "box", box });
      }
      for (const event of events) {
        if (sentEvents.current.has(event.id)) continue;
        sentEvents.current.add(event.id);
        post({ type: "event", event });
      }
      if (sentEvents.current.size > 500) {
        sentEvents.current = new Set(
          [...sentEvents.current].slice(-250)
        );
      }
    }

    return () => window.removeEventListener("message", onMessage);
    // `settings` and `box` are carried by the keys below; listing the objects
    // themselves would resubscribe on every poll for no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, channelId, settingsKey, boxKey, eventsKey, frameRef]);
}

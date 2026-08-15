import { describe, expect, it } from "vitest";
import {
  OVERLAY_MESSAGE_NS,
  OVERLAY_MESSAGE_VERSION,
  overlayMessage,
  parseOverlayMessage,
  sameBox,
  type OverlayMessage,
} from "@/lib/overlay-messages";

const BOX = { width: 480, height: 320, scale: 1 };

describe("addressing a message to this protocol", () => {
  it("stamps the namespace and version", () => {
    expect(overlayMessage({ type: "ready" })).toEqual({
      type: "ready",
      ns: OVERLAY_MESSAGE_NS,
      v: OVERLAY_MESSAGE_VERSION,
    });
  });

  it("round trips every type", () => {
    const messages: OverlayMessage[] = [
      { type: "ready" },
      { type: "settings", settings: { scale: 1 } },
      { type: "box", box: BOX },
      { type: "hello", channel: "chan-1", settings: {}, box: BOX },
    ];
    for (const message of messages) {
      expect(parseOverlayMessage(overlayMessage(message))).toMatchObject({
        type: message.type,
      });
    }
  });
});

// A page hosts other people's frames and the browser delivers everyone's
// messages to the same listener, so most of this function's job is saying no.
describe("what is refused", () => {
  it("refuses anything without this namespace", () => {
    expect(parseOverlayMessage({ type: "ready", v: 1 })).toBeNull();
    expect(
      parseOverlayMessage({ type: "ready", v: 1, ns: "something-else" })
    ).toBeNull();
  });

  it("refuses a version it does not understand", () => {
    expect(
      parseOverlayMessage({
        type: "ready",
        ns: OVERLAY_MESSAGE_NS,
        v: OVERLAY_MESSAGE_VERSION + 1,
      })
    ).toBeNull();
    expect(
      parseOverlayMessage({
        type: "ready",
        ns: OVERLAY_MESSAGE_NS,
      })
    ).toBeNull();
  });

  it("refuses a type it does not know", () => {
    expect(
      parseOverlayMessage({
        type: "shutdown",
        ns: OVERLAY_MESSAGE_NS,
        v: OVERLAY_MESSAGE_VERSION,
      })
    ).toBeNull();
  });

  it("refuses a payload that is not an object", () => {
    expect(parseOverlayMessage(null)).toBeNull();
    expect(parseOverlayMessage("ready")).toBeNull();
    expect(parseOverlayMessage(["ready"])).toBeNull();
    expect(parseOverlayMessage(7)).toBeNull();
  });

  it("refuses a message with no type", () => {
    expect(
      parseOverlayMessage({
        ns: OVERLAY_MESSAGE_NS,
        v: OVERLAY_MESSAGE_VERSION,
      })
    ).toBeNull();
  });
});

describe("comparing a box", () => {
  it("is equal only when every dimension matches", () => {
    expect(sameBox(BOX, { ...BOX })).toBe(true);
    expect(sameBox(BOX, { ...BOX, scale: 2 })).toBe(false);
    expect(sameBox(BOX, { ...BOX, width: 481 })).toBe(false);
    expect(sameBox(null, null)).toBe(true);
    expect(sameBox(BOX, null)).toBe(false);
  });
});

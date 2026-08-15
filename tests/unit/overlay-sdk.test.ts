// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectOverlay } from "../../public/overlay-sdk.js";

// The SDK is what a third party runs, so it is exercised as a third party would:
// loaded as a module, in a document whose parent is somebody else.

const NS = "vidstube-overlay";
const BOX = { width: 480, height: 320, scale: 1 };

let posted: { data: unknown; target: string }[] = [];

function asParent() {
  posted = [];
  const parent = {
    postMessage: (data: unknown, target: string) => {
      posted.push({ data, target });
    },
  };
  Object.defineProperty(window, "parent", { value: parent, writable: true });
  return parent;
}

function deliver(data: unknown, source: unknown = window.parent) {
  window.dispatchEvent(
    new MessageEvent("message", { data, source: source as Window })
  );
}

const hello = (settings: Record<string, unknown> = {}) => ({
  ns: NS,
  v: 1,
  type: "hello",
  settings,
  box: BOX,
});

beforeEach(() => {
  asParent();
});

describe("what the SDK says", () => {
  it("announces itself to the parent as soon as it connects", () => {
    connectOverlay();
    expect(posted).toHaveLength(1);
    expect(posted[0].data).toEqual({ ns: NS, v: 1, type: "ready" });
  });

  // An overlay cannot know its host's origin, and once overlays are proxied it
  // will be told even less about it. The message says only "I exist".
  it("announces to a wildcard, because it does not know the host's origin", () => {
    connectOverlay();
    expect(posted[0].target).toBe("*");
  });
});

describe("what the SDK hears", () => {
  it("takes the channel, settings and box from hello", () => {
    const overlay = connectOverlay();
    deliver(hello({ scale: 1.5 }));
    expect(overlay.settings).toEqual({ scale: 1.5 });
    expect(overlay.box).toEqual(BOX);
  });

  it("delivers a later settings change to a subscriber", () => {
    const overlay = connectOverlay();
    const seen: unknown[] = [];
    overlay.onSettings((settings: unknown) => seen.push(settings));
    deliver(hello({ scale: 1 }));
    deliver({ ns: NS, v: 1, type: "settings", settings: { scale: 2 } });
    expect(seen).toEqual([{ scale: 1 }, { scale: 2 }]);
  });

  it("replays what it already knows to a late subscriber", () => {
    const overlay = connectOverlay();
    deliver(hello({ scale: 1 }));
    const seen: unknown[] = [];
    overlay.onSettings((settings: unknown) => seen.push(settings));
    expect(seen).toEqual([{ scale: 1 }]);
  });

  it("delivers a resized box", () => {
    const overlay = connectOverlay();
    const seen: unknown[] = [];
    overlay.onBox((box: unknown) => seen.push(box));
    deliver(hello());
    deliver({
      ns: NS,
      v: 1,
      type: "box",
      box: { ...BOX, scale: 2 },
    });
    expect(seen).toEqual([BOX, { ...BOX, scale: 2 }]);
  });
});

describe("events", () => {
  const feed = {
    id: "e1",
    keyword: "feed",
    args: null,
    at: "2026-08-15T00:00:00.000Z",
    actor: "opaque-actor",
    actorName: "Bob",
  };

  it("delivers a command run for this overlay", () => {
    const overlay = connectOverlay();
    const seen: unknown[] = [];
    overlay.onEvent((event: unknown) => seen.push(event));
    deliver(hello());
    deliver({ ns: NS, v: 1, type: "event", event: feed });
    expect(seen).toEqual([feed]);
  });

  // An event is a thing that happened. A listener attached afterwards has
  // genuinely missed it, and pretending otherwise would replay a chatter's
  // action at a moment nobody chose.
  it("does not replay an event to a late subscriber", () => {
    const overlay = connectOverlay();
    deliver(hello());
    deliver({ ns: NS, v: 1, type: "event", event: feed });
    const seen: unknown[] = [];
    overlay.onEvent((event: unknown) => seen.push(event));
    expect(seen).toEqual([]);
  });

  it("ignores an event message carrying no event", () => {
    const overlay = connectOverlay();
    const seen: unknown[] = [];
    overlay.onEvent((event: unknown) => seen.push(event));
    deliver({ ns: NS, v: 1, type: "event" });
    expect(seen).toEqual([]);
  });
});

describe("what the SDK refuses", () => {
  it("ignores a message that did not come from the parent", () => {
    const overlay = connectOverlay();
    deliver(hello({ scale: 9 }), { other: true });
    expect(overlay.settings).toEqual({});
  });

  it("ignores another protocol's message", () => {
    const overlay = connectOverlay();
    deliver({ ns: "someone-else", v: 1, type: "hello", settings: { a: 1 } });
    deliver({ type: "hello", settings: { a: 1 } });
    expect(overlay.settings).toEqual({});
  });

  it("ignores a version it does not understand", () => {
    const overlay = connectOverlay();
    deliver({ ns: NS, v: 2, type: "settings", settings: { a: 1 } });
    expect(overlay.settings).toEqual({});
  });

  it("survives a listener that throws", () => {
    const overlay = connectOverlay();
    vi.spyOn(console, "error").mockImplementation(() => {});
    overlay.onSettings(() => {
      throw new Error("a third party's bug");
    });
    const seen: unknown[] = [];
    overlay.onSettings((settings: unknown) => seen.push(settings));
    deliver(hello({ scale: 3 }));
    expect(seen).toEqual([{ scale: 3 }]);
  });
});

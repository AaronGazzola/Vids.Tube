// @vitest-environment happy-dom
import { MessageBanner } from "@/components/overlay/message-banner";
import { OVERLAY_MESSAGE_DWELL_MS } from "@/lib/demo-overlay";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const METRICS = {
  totalSubs: 0,
  newSubsThisStream: 0,
  likesThisStream: 0,
  currentViewers: 0,
  chattersThisStream: 0,
  chatsThisStream: 0,
  commandsThisStream: 0,
  members: 0,
  newMembersThisStream: 0,
};

type Msg = { text: string; align: "left" | "center"; dwellMs?: number };
const msg = (text: string, dwellMs?: number): Msg => ({
  text,
  align: "left",
  ...(dwellMs === undefined ? {} : { dwellMs }),
});

const A = "first message";
const B = "second message";
const C = "third message";

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(messages: Msg[], opts: { dwellMs?: number; border?: boolean } = {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <MessageBanner
        metrics={METRICS}
        messages={messages}
        dwellMs={opts.dwellMs}
        border={opts.border}
      />
    );
  });
}

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const showing = () =>
  host!.querySelector('[data-testid="message-banner-showing"]')!.textContent ??
  "";

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

describe("the banner cycles at the configured time", () => {
  it("holds each message for the global time", () => {
    mount([msg(A), msg(B)], { dwellMs: 10_000 });
    expect(showing()).toContain(A);
    // Still on the first message at what used to be the fixed dwell.
    tick(OVERLAY_MESSAGE_DWELL_MS);
    expect(showing()).toContain(A);
    tick(4000);
    expect(showing()).toContain(B);
  });

  it("lets a message override the global with its own time", () => {
    mount([msg(A, 2000), msg(B)], { dwellMs: 10_000 });
    tick(2000);
    expect(showing()).toContain(B);
    // The second message carries none of its own, so it takes the global.
    tick(9999);
    expect(showing()).toContain(B);
    tick(1);
    expect(showing()).toContain(A);
  });

  it("times each message in a mixed list by its own rule", () => {
    mount([msg(A, 2000), msg(B), msg(C, 3000)], { dwellMs: 5000 });
    tick(2000);
    expect(showing()).toContain(B);
    tick(5000);
    expect(showing()).toContain(C);
    tick(3000);
    expect(showing()).toContain(A);
  });

  it("falls back to the default when no global is configured", () => {
    mount([msg(A), msg(B)]);
    tick(OVERLAY_MESSAGE_DWELL_MS - 1);
    expect(showing()).toContain(A);
    tick(1);
    expect(showing()).toContain(B);
  });

  it("ignores an unusable per-message time and takes the global", () => {
    mount([msg(A, 0), msg(B)], { dwellMs: 4000 });
    tick(3999);
    expect(showing()).toContain(A);
    tick(1);
    expect(showing()).toContain(B);
  });

  it("starts no timer for a single message", () => {
    mount([msg(A)], { dwellMs: 2000 });
    tick(60_000);
    expect(showing()).toContain(A);
  });
});

describe("the banner's border", () => {
  const frame = () =>
    host!.querySelector('[data-testid="message-banner-window"]')!
      .parentElement!;

  it("is drawn by default", () => {
    mount([msg(A)]);
    expect(frame().className).toContain("overlay-surface");
    expect(frame().className).toContain("border-white");
  });

  it("is gone when switched off, and the text remains", () => {
    mount([msg(A)], { border: false });
    expect(frame().className).not.toContain("overlay-surface");
    expect(frame().className).not.toContain("border-white");
    expect(showing()).toContain(A);
  });

  it("keeps the banner the same width either way", () => {
    mount([msg(A)]);
    const withBorder = frame().getAttribute("style");
    act(() => root?.unmount());
    host?.remove();
    mount([msg(A)], { border: false });
    expect(frame().getAttribute("style")).toBe(withBorder);
  });
});

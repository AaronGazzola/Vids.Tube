// @vitest-environment happy-dom
import { MemberCountStrip } from "@/components/overlay/member-count-strip";
import { OVERLAY_MESSAGE_DWELL_MS } from "@/lib/demo-overlay";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const COUNT = 143;
const msg = (text: string, align: "left" | "center" = "left") => ({ text, align });
const FIRST = "Chat to become a member!";
const SECOND = "Ask me anything with !ask";

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(messages: { text: string; align: "left" | "center" }[]) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(<MemberCountStrip count={COUNT} messages={messages} />);
  });
}

function advance() {
  act(() => {
    vi.advanceTimersByTime(OVERLAY_MESSAGE_DWELL_MS);
  });
}

const showing = () =>
  host!.querySelector('[data-testid="member-strip-showing"]')!;
const leaving = () =>
  host!.querySelector('[data-testid="member-strip-leaving"]');

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

describe("the member count belongs to the first message", () => {
  it("puts the count beside the first message", () => {
    mount([msg(FIRST), msg(SECOND)]);
    expect(showing().textContent).toContain(FIRST);
    expect(showing().textContent).toContain("143");
  });

  it("shows no count once a later message is showing", () => {
    mount([msg(FIRST), msg(SECOND)]);
    advance();
    expect(showing().textContent).toContain(SECOND);
    expect(showing().textContent).not.toContain("143");
  });

  it("brings the count back when the cycle returns to the first message", () => {
    mount([msg(FIRST), msg(SECOND)]);
    advance();
    advance();
    expect(showing().textContent).toContain(FIRST);
    expect(showing().textContent).toContain("143");
  });

  it("shows the total as it stands rather than the total from last cycle", () => {
    mount([msg(FIRST), msg(SECOND)]);
    advance();
    act(() => {
      root!.render(
        <MemberCountStrip count={999} messages={[msg(FIRST), msg(SECOND)]} />
      );
    });
    advance();
    expect(showing().textContent).toContain("999");
  });
});

describe("several messages take turns", () => {
  it("shows each message in the order the streamer set, and repeats", () => {
    const third = "Third thing";
    mount([msg(FIRST), msg(SECOND), msg(third)]);
    const seen = [showing().textContent];
    for (let i = 0; i < 3; i += 1) {
      advance();
      seen.push(showing().textContent);
    }
    expect(seen[0]).toContain(FIRST);
    expect(seen[1]).toContain(SECOND);
    expect(seen[2]).toContain(third);
    expect(seen[3]).toContain(FIRST);
  });

  it("draws the outgoing message alongside the incoming one while advancing", () => {
    mount([msg(FIRST), msg(SECOND)]);
    advance();
    expect(leaving()!.textContent).toContain(FIRST);
    expect(showing().textContent).toContain(SECOND);
  });
});

describe("a single message does not cycle", () => {
  it("renders one message with no transition on it", () => {
    const html = renderToStaticMarkup(
      <MemberCountStrip count={COUNT} messages={[msg(FIRST)]} />
    );
    expect(html).toContain(FIRST);
    expect(html).not.toContain("overlay-message-in");
    expect(html).not.toContain("overlay-message-out");
  });

  it("never advances or animates, however long the broadcast runs", () => {
    mount([msg(FIRST)]);
    advance();
    advance();
    expect(showing().textContent).toContain(FIRST);
    expect(leaving()).toBeNull();
  });

  it("falls back to the site's own sentence when nothing is configured", () => {
    const html = renderToStaticMarkup(
      <MemberCountStrip count={COUNT} messages={[]} />
    );
    expect(html).toContain("Chat to become a member at Vids.Tube!");
    expect(html).not.toContain("overlay-message-in");
  });

  it("ignores a message added in Settings but not yet written", () => {
    mount([msg(FIRST), msg("   ")]);
    advance();
    expect(showing().textContent).toContain(FIRST);
    expect(leaving()).toBeNull();
  });
});

describe("a message can be centred on its line", () => {
  it("leaves a message on the left unless it is centred", () => {
    mount([msg(FIRST)]);
    const text = showing().querySelector('[data-testid="member-strip-text"]')!;
    expect(text.className).not.toContain("text-center");
  });

  it("centres a message the streamer chose to centre", () => {
    mount([msg(FIRST, "center")]);
    const text = showing().querySelector('[data-testid="member-strip-text"]')!;
    expect(text.className).toContain("text-center");
  });

  it("keeps alignment with its own message as the strip cycles", () => {
    mount([msg(FIRST, "center"), msg(SECOND)]);
    expect(
      showing().querySelector('[data-testid="member-strip-text"]')!.className
    ).toContain("text-center");
    advance();
    expect(
      showing().querySelector('[data-testid="member-strip-text"]')!.className
    ).not.toContain("text-center");
  });
});

describe("formatting reaches the strip", () => {
  it("draws marked-up runs as elements rather than as characters", () => {
    const html = renderToStaticMarkup(
      <MemberCountStrip count={COUNT} messages={[msg("say **it** {#ff0055|now}")]} />
    );
    expect(html).toContain("font-bold");
    expect(html).toContain("#ff0055");
    expect(html).not.toContain("**");
  });

  it("draws a malformed message as the words that were typed", () => {
    const html = renderToStaticMarkup(
      <MemberCountStrip count={COUNT} messages={[msg("join **us today")]} />
    );
    expect(html).toContain("join **us today");
  });
});

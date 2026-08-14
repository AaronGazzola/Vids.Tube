// @vitest-environment happy-dom
import { MessageBanner } from "@/components/overlay/message-banner";
import { OVERLAY_MESSAGE_DWELL_MS } from "@/lib/demo-overlay";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const COUNT = 143;
// Every kind resolved, so a message asking for one gets a number.
const METRICS = {
  totalSubs: 4820,
  newSubsThisStream: 37,
  likesThisStream: 214,
  currentViewers: 63,
  chattersThisStream: 84,
  chatsThisStream: 1180,
  commandsThisStream: 96,
  members: COUNT,
  newMembersThisStream: 9,
};
const MEMBERS_METRIC = {
  kind: "members" as const,
  icon: "logo" as const,
  color: "#ffffff",
};
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
    root!.render(<MessageBanner metrics={METRICS} messages={messages} />);
  });
}

function advance() {
  act(() => {
    vi.advanceTimersByTime(OVERLAY_MESSAGE_DWELL_MS);
  });
}

const showing = () =>
  host!.querySelector('[data-testid="message-banner-showing"]')!;
const leaving = () =>
  host!.querySelector('[data-testid="message-banner-leaving"]');

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

describe("a metric belongs to the message carrying it", () => {
  const withMetric = (text: string) => ({
    ...msg(text),
    metric: MEMBERS_METRIC,
  });

  it("draws the number beside the message that asked for it", () => {
    mount([withMetric(FIRST), msg(SECOND)]);
    expect(showing().textContent).toContain(FIRST);
    expect(showing().textContent).toContain("143");
  });

  it("draws no number beside a message that did not", () => {
    mount([withMetric(FIRST), msg(SECOND)]);
    advance();
    expect(showing().textContent).toContain(SECOND);
    expect(showing().textContent).not.toContain("143");
  });

  it("puts a number on a later message when that is where it was asked for", () => {
    mount([msg(FIRST), withMetric(SECOND)]);
    expect(showing().textContent).not.toContain("143");
    advance();
    expect(showing().textContent).toContain("143");
  });

  it("draws a dash and keeps the icon when the number cannot be resolved", () => {
    act(() => {
      root?.unmount();
    });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root!.render(
        <MessageBanner
          metrics={{ ...METRICS, members: null }}
          messages={[withMetric(FIRST)]}
        />
      );
    });
    expect(showing().textContent).toContain(FIRST);
    expect(showing().textContent).not.toContain("143");
    // The block stays, so the layout does not move when the number arrives.
    const metric = host!.querySelector('[data-testid="message-banner-metric"]')!;
    expect(metric).not.toBeNull();
    expect(metric.textContent).toContain("—");
    expect(metric.querySelector("svg")).not.toBeNull();
  });

  it("shows the number as it stands rather than the one from last cycle", () => {
    mount([withMetric(FIRST), msg(SECOND)]);
    advance();
    act(() => {
      root!.render(
        <MessageBanner
          metrics={{ ...METRICS, members: 999 }}
          messages={[withMetric(FIRST), msg(SECOND)]}
        />
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
      <MessageBanner metrics={METRICS} messages={[msg(FIRST)]} />
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
      <MessageBanner metrics={METRICS} messages={[]} />
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
    const text = showing().querySelector('[data-testid="message-banner-text"]')!;
    expect(text.className).not.toContain("text-center");
  });

  it("centres a message the streamer chose to centre", () => {
    mount([msg(FIRST, "center")]);
    const text = showing().querySelector('[data-testid="message-banner-text"]')!;
    expect(text.className).toContain("text-center");
  });

  it("keeps alignment with its own message as the strip cycles", () => {
    mount([msg(FIRST, "center"), msg(SECOND)]);
    expect(
      showing().querySelector('[data-testid="message-banner-text"]')!.className
    ).toContain("text-center");
    advance();
    expect(
      showing().querySelector('[data-testid="message-banner-text"]')!.className
    ).not.toContain("text-center");
  });
});

describe("formatting reaches the strip", () => {
  it("draws marked-up runs as elements rather than as characters", () => {
    const html = renderToStaticMarkup(
      <MessageBanner metrics={METRICS} messages={[msg("say **it** {#ff0055|now}")]} />
    );
    expect(html).toContain("font-bold");
    expect(html).toContain("#ff0055");
    expect(html).not.toContain("**");
  });

  it("draws a malformed message as the words that were typed", () => {
    const html = renderToStaticMarkup(
      <MessageBanner metrics={METRICS} messages={[msg("join **us today")]} />
    );
    expect(html).toContain("join **us today");
  });
});

describe("the icon beside a metric", () => {
  const withIcon = (icon: string) => ({
    ...msg(FIRST),
    metric: { kind: "members" as const, icon: icon as never, color: "#ff0055" },
  });

  it("draws the chosen icon in the chosen colour", () => {
    mount([withIcon("flame")]);
    const metric = host!.querySelector('[data-testid="message-banner-metric"]')!;
    const svg = metric.querySelector("svg")!;
    expect(svg.getAttribute("fill")).toBe("#ff0055");
  });

  // A saved layout must never be able to break the banner.
  it("falls back to the logo for a name this build does not know", () => {
    mount([withIcon("nonsense")]);
    const metric = host!.querySelector('[data-testid="message-banner-metric"]')!;
    expect(metric.textContent).toContain("143");
    expect(metric.querySelector("svg")).not.toBeNull();
  });
});

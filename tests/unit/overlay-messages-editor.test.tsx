// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/browser-client", () => ({ supabase: {} }));

import { MessagesSection } from "@/app/(app)/live/settings-tab";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDemoLayoutStore } from "@/app/(app)/live/demo.stores";
import type { StripMessage } from "@/app/(app)/live/demo.types";
import { OVERLAY_MESSAGE_MAX_VISIBLE } from "@/lib/demo-overlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;
let host: HTMLElement | null = null;

const msg = (
  text: string,
  align: "left" | "center" = "left"
): StripMessage => ({ text, align });
// The draft is what the editor writes; the config is what a broadcast reads.
const draft = () => useDemoLayoutStore.getState().draftMessages;
const saved = () => useDemoLayoutStore.getState().config.messages;
const messages = () => draft().map((m) => m.text);

function mount(initial: StripMessage[]) {
  act(() => {
    useDemoLayoutStore.getState().setDraftMessages(initial);
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    // The section resolves the banner's real numbers, so it needs a client.
    // Queries stay unresolved here, which is the point: an unresolved metric
    // draws nothing, and these tests are about the messages rather than the
    // numbers.
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <MessagesSection channelSlug="owner" />
      </QueryClientProvider>
    );
  });
}

const field = (n = 0) =>
  host!.querySelector<HTMLElement>(`[aria-label="Message ${n + 1}"]`)!;

const button = (label: string) =>
  host!.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

// The field is contenteditable, so typing means replacing its text and letting
// it read itself back, which is what a keystroke does in a browser.
function type(value: string, n = 0) {
  const el = field(n);
  act(() => {
    el.textContent = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// Selecting inside a contenteditable means a DOM range over its text nodes.
function select(from: number, to: number, n = 0) {
  const el = field(n);
  const texts: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) texts.push(node as Text);
    else node.childNodes.forEach(walk);
  };
  walk(el);
  const locate = (offset: number): [Node, number] => {
    let left = offset;
    for (const t of texts) {
      const len = t.textContent?.length ?? 0;
      if (left <= len) return [t, left];
      left -= len;
    }
    const last = texts[texts.length - 1];
    return last ? [last, last.textContent?.length ?? 0] : [el, 0];
  };
  const range = document.createRange();
  const [sn, so] = locate(from);
  const [en, eo] = locate(to);
  range.setStart(sn, so);
  range.setEnd(en, eo);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  act(() => {
    el.dispatchEvent(new Event("mouseup", { bubbles: true }));
  });
}

beforeEach(() => {
  act(() => {
    useDemoLayoutStore
      .getState()
      .setDraftMessages([msg("Chat to become a member at Vids.Tube!")]);
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("a control wraps what the streamer selected", () => {
  it("wraps a selection in the bold markup and leaves the rest alone", () => {
    mount([msg("say it now")]);
    select(4, 6);
    act(() => button("Bold").click());
    expect(messages()[0]).toBe("say **it** now");
  });

  it("wraps a selection in the italic markup", () => {
    mount([msg("say it now")]);
    select(4, 6);
    act(() => button("Italic").click());
    expect(messages()[0]).toBe("say *it* now");
  });

  it("wraps a selection in the underline markup", () => {
    mount([msg("say it now")]);
    select(4, 6);
    act(() => button("Underline").click());
    expect(messages()[0]).toBe("say __it__ now");
  });

  // Styling applies to a selection now that the field is styled text rather
  // than markup: there is no punctuation to drop at a cursor, and an empty pair
  // would be invisible in a field that shows the result rather than the source.
  it("does nothing with nothing selected, and reads as off", () => {
    mount([msg("say now")]);
    select(4, 4);
    act(() => button("Bold").click());
    expect(messages()[0]).toBe("say now");
    expect(button("Bold").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("the visible length is capped, and formatting is free", () => {
  it("accepts a message whose markup makes the stored text longer than the cap", () => {
    mount([msg("")]);
    const long = "x".repeat(OVERLAY_MESSAGE_MAX_VISIBLE);
    type(`{#ff0055|**${long}**}`);
    expect(messages()[0]).toBe(`{#ff0055|**${long}**}`);
  });

  it("refuses a message whose visible text goes over the cap", () => {
    mount([msg("short")]);
    type("y".repeat(OVERLAY_MESSAGE_MAX_VISIBLE + 1));
    expect(messages()[0]).toBe("short");
  });

  it("names the limit rather than failing silently", () => {
    mount([msg("short")]);
    type("y".repeat(OVERLAY_MESSAGE_MAX_VISIBLE + 1));
    expect(host!.textContent).toContain(String(OVERLAY_MESSAGE_MAX_VISIBLE));
    expect(host!.textContent).toContain("visible");
  });

  it("shows how much room is left as the message is written", () => {
    mount([msg("12345")]);
    expect(host!.textContent).toContain(
      `${OVERLAY_MESSAGE_MAX_VISIBLE - 5} left`
    );
  });
});

describe("adding, removing and reordering", () => {
  it("adds an empty message for the streamer to write", () => {
    mount([msg("one")]);
    act(() => {
      host!
        .querySelectorAll("button")
        .forEach((b) => b.textContent === "Add message" && b.click());
    });
    expect(messages()).toEqual(["one", ""]);
  });

  it("removes the message the streamer chose and keeps the others", () => {
    mount([msg("one"), msg("two"), msg("three")]);
    act(() => {
      const remove = [...host!.querySelectorAll("button")].filter(
        (b) => b.textContent === "Remove"
      );
      remove[1].click();
    });
    expect(messages()).toEqual(["one", "three"]);
  });

  it("moves a message up, changing the order the strip will show", () => {
    mount([msg("one"), msg("two"), msg("three")]);
    act(() => button("Move message 2 up").click());
    expect(messages()).toEqual(["two", "one", "three"]);
  });

  it("moves a message down", () => {
    mount([msg("one"), msg("two"), msg("three")]);
    act(() => button("Move message 1 down").click());
    expect(messages()).toEqual(["two", "one", "three"]);
  });

  it("offers no way to move the first message up or the last one down", () => {
    mount([msg("one"), msg("two")]);
    expect(button("Move message 1 up").disabled).toBe(true);
    expect(button("Move message 2 down").disabled).toBe(true);
  });
});

describe("centring a message", () => {
  it("starts every message on the left", () => {
    mount([msg("one")]);
    expect(draft()[0].align).toBe("left");
  });

  it("centres the message the streamer chose, and only that one", () => {
    mount([msg("one"), msg("two")]);
    act(() => button("Centre message 2").click());
    expect(draft()[0].align).toBe("left");
    expect(draft()[1].align).toBe("center");
  });

  it("puts a centred message back on the left when pressed again", () => {
    mount([msg("one", "center")]);
    act(() => button("Centre message 1").click());
    expect(draft()[0].align).toBe("left");
  });

  it("keeps the words untouched when only the alignment changes", () => {
    mount([msg("say **it** now")]);
    act(() => button("Centre message 1").click());
    expect(draft()[0].text).toBe("say **it** now");
  });

  // The editable surface is the banner, so centring shows on the field itself
  // rather than on a drawn copy of the message.
  it("centres the editable line on the banner", () => {
    mount([msg("one", "center")]);
    const field = host!.querySelector<HTMLElement>(
      '.overlay-surface [aria-label="Message 1"]'
    )!;
    expect(field.style.textAlign).toBe("center");
  });
});

// A half-typed sentence must never reach a broadcast. Editing writes a draft;
// only Save changes puts it where the overlay reads from.
describe("nothing reaches the overlay until the changes are saved", () => {
  it("leaves the saved messages alone while a message is being written", () => {
    const before = saved();
    mount([msg("a brand new message")]);
    type("still typing");
    expect(saved()).toEqual(before);
  });

  it("leaves the saved messages alone when one is added or removed", () => {
    const before = saved();
    mount([msg("one"), msg("two")]);
    act(() => button("Move message 1 down").click());
    expect(saved()).toEqual(before);
  });

  it("says the edits are not on the overlay yet", () => {
    mount([msg("one")]);
    type("changed");
    expect(host!.textContent).toContain("Save changes");
  });

  it("puts the draft on the overlay once the changes are committed", () => {
    mount([msg("one"), msg("two", "center")]);
    act(() => useDemoLayoutStore.getState().commitMessages());
    expect(saved()).toEqual([msg("one"), msg("two", "center")]);
  });

  it("says nothing about pending edits once they are committed", () => {
    mount([msg("one")]);
    act(() => useDemoLayoutStore.getState().commitMessages());
    expect(host!.textContent).not.toContain("Save changes");
  });
});

describe("the banner is the thing being edited", () => {
  it("draws each message on the banner's own backing", () => {
    mount([msg("one"), msg("two")]);
    expect(host!.querySelectorAll(".overlay-surface")).toHaveLength(2);
  });

  it("shows formatting rather than markup, in the editable surface itself", () => {
    mount([msg("say **it** now")]);
    const banner = host!.querySelector(".overlay-surface")!;
    const field = banner.querySelector('[aria-label="Message 1"]')!;
    expect(field.textContent).toContain("say it now");
    expect(field.textContent).not.toContain("**");
    expect(field.querySelector("span[style*='font-weight']")?.textContent).toBe(
      "it"
    );
  });

  it("has no second copy of the message to compare against", () => {
    mount([msg("one")]);
    // One surface, and the editable field is inside it.
    const surfaces = host!.querySelectorAll(".overlay-surface");
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0].querySelector('[aria-label="Message 1"]')).not.toBeNull();
  });

  // The editor draws the real numbers, so with none resolved it draws none.
  // A stand-in figure here would mean composing a layout against something that
  // will never appear.
  it("draws a dash while there is no number to draw", () => {
    mount([
      {
        ...msg("one"),
        metric: {
          kind: "members" as const,
          icon: "logo" as const,
          color: "#ffffff",
        },
      },
    ]);
    const surface = host!.querySelector(".overlay-surface")!;
    const metric = surface.querySelector('[data-testid="message-banner-metric"]')!;
    expect(metric).not.toBeNull();
    expect(metric.textContent).toContain("—");
    // The choice is still recorded, and its controls still show it.
    expect(
      host!.querySelector<HTMLInputElement>(
        '[aria-label="Show a metric on message 1"]'
      )!.checked
    ).toBe(true);
  });
});

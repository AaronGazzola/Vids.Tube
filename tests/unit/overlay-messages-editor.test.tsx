// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/browser-client", () => ({ supabase: {} }));

import { MessagesSection } from "@/app/(app)/live/settings-tab";
import { useDemoLayoutStore } from "@/app/(app)/live/demo.stores";
import { OVERLAY_MESSAGE_MAX_VISIBLE } from "@/lib/demo-overlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;
let host: HTMLElement | null = null;

const msg = (text: string, align: "left" | "center" = "left") => ({ text, align });
// The draft is what the editor writes; the config is what a broadcast reads.
const draft = () => useDemoLayoutStore.getState().draftMessages;
const saved = () => useDemoLayoutStore.getState().config.messages;
const messages = () => draft().map((m) => m.text);

function mount(initial: { text: string; align: "left" | "center" }[]) {
  act(() => {
    useDemoLayoutStore.getState().setDraftMessages(initial);
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(<MessagesSection />);
  });
}

const field = (n = 0) =>
  host!.querySelector<HTMLInputElement>(`[aria-label="Message ${n + 1}"]`)!;

const button = (label: string) =>
  host!.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

function type(value: string, n = 0) {
  const el = field(n);
  act(() => {
    // What React's onChange sees when a streamer types.
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function select(from: number, to: number, n = 0) {
  const el = field(n);
  el.focus();
  el.setSelectionRange(from, to);
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

  it("inserts an empty pair at the cursor when nothing is selected", () => {
    mount([msg("say now")]);
    select(4, 4);
    act(() => button("Bold").click());
    expect(messages()[0]).toBe("say ****now");
  });
});

describe("colour is picked rather than typed", () => {
  it("writes the chosen colour into the token around the selection", () => {
    mount([msg("say it now")]);
    select(4, 6);
    const picker = host!.querySelector<HTMLInputElement>(
      '[aria-label="Colour for message 1"]'
    )!;
    act(() => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )!.set!.call(picker, "#ff0055");
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(messages()[0]).toBe("say {#ff0055|it} now");
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

  it("shows the centring in the preview", () => {
    mount([msg("one", "center")]);
    const preview = host!.querySelector(
      '.overlay-surface [data-testid="member-strip-text"]'
    )!;
    expect(preview.className).toContain("text-center");
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

describe("the message is drawn as the overlay will draw it", () => {
  it("previews each message on the strip's own backing", () => {
    mount([msg("one"), msg("two")]);
    expect(host!.querySelectorAll(".overlay-surface")).toHaveLength(2);
  });

  it("previews the formatting rather than the markup", () => {
    mount([msg("say **it** now")]);
    const preview = host!.querySelector(".overlay-surface")!;
    expect(preview.textContent).toContain("say it now");
    expect(preview.textContent).not.toContain("**");
    expect(preview.querySelector(".font-bold")?.textContent).toBe("it");
  });

  it("shows the member count beside the first message only", () => {
    mount([msg("one"), msg("two")]);
    const previews = host!.querySelectorAll(".overlay-surface");
    expect(previews[0].textContent).toContain("143");
    expect(previews[1].textContent).not.toContain("143");
  });
});

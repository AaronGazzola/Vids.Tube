// @vitest-environment happy-dom
import { WelcomeCard, welcomeText } from "@/components/overlay/welcome-card";
import type { FeaturedAuthor } from "@/app/layout.types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const author = (handle: string | null, name = "Someone"): FeaturedAuthor => ({
  name,
  handle,
  avatarUrl: null,
  avatarPath: null,
});

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(
  kind: "new" | "returning" | "batch",
  authors: FeaturedAuthor[]
) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <WelcomeCard kind={kind} authors={authors} onDone={() => {}} />
    );
  });
}

const card = () => host!.querySelector('[data-testid="overlay-welcome-card"]')!;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("the welcome card", () => {
  it("presents a first-time chatter as a new member", () => {
    mount("new", [author("ava")]);
    expect(card().textContent).toContain("New member");
    expect(card().textContent).toContain("@ava");
  });

  it("presents a returning chatter differently", () => {
    mount("returning", [author("ava")]);
    expect(card().textContent).toContain("Welcome back");
    expect(card().textContent).not.toContain("New member");
  });

  it("shows a burst as one card naming everyone", () => {
    mount("batch", [author("a"), author("b"), author("c")]);
    expect(card().textContent).toContain("@a");
    expect(card().textContent).toContain("@b");
    expect(card().textContent).toContain("@c");
  });

  it("draws the avatar above the message", () => {
    mount("new", [author("ava")]);
    const stack = card().firstElementChild!;
    expect(stack.className).toContain("flex-col");
  });

  it("falls back to the display name when there is no handle", () => {
    mount("new", [author(null, "Ava Chen")]);
    expect(card().textContent).toContain("Ava Chen");
  });

  it("draws an avatar for a chatter with no picture", () => {
    mount("new", [author("ava")]);
    // AvatarBubble always renders its own frame, with a placeholder inside.
    expect(card().querySelector("svg")).not.toBeNull();
  });

  it("records the kind it is drawing, so the surfaces can be compared", () => {
    mount("batch", [author("a")]);
    expect(card().getAttribute("data-welcome-kind")).toBe("batch");
  });
});

describe("welcomeText", () => {
  it("does not carry a link, which a viewer cannot click on a broadcast", () => {
    for (const kind of ["new", "returning", "batch"] as const) {
      const { lead, body } = welcomeText(kind, [author("ava")]);
      expect(`${lead} ${body}`).not.toMatch(/https?:|vids\.tube/);
    }
  });
});

// @vitest-environment happy-dom
import { GameWindow } from "@/components/overlay/game-window";
import type { OverlayInstallation } from "@/lib/overlay-frame";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const PERMITTED = "https://game.example";
const ENTRY = `${PERMITTED}/rig`;

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(installation: OverlayInstallation) {
  act(() => {
    root!.render(<GameWindow installation={installation} />);
  });
}

const src = () =>
  host!.querySelector('[data-testid="game-window"]')!.getAttribute("src");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", ENTRY);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.unstubAllEnvs();
});

// The host re-mints on every poll of the installation query. If a fresh token
// reached `src`, the frame would reload every fifteen seconds and restart
// whatever the overlay was running, which for a game means losing its world.
describe("what makes the framed address change", () => {
  it("holds the address across a re-minted token for the same installation", () => {
    render({ installId: "inst-1", entryUrl: ENTRY, token: "tok-1" });
    const first = src();
    expect(first).toBe(`${ENTRY}?t=tok-1`);

    render({ installId: "inst-1", entryUrl: ENTRY, token: "tok-2" });
    expect(src()).toBe(first);
  });

  it("swaps the address when a different overlay is installed", () => {
    render({ installId: "inst-1", entryUrl: ENTRY, token: "tok-1" });
    render({ installId: "inst-2", entryUrl: ENTRY, token: "tok-2" });
    expect(src()).toBe(`${ENTRY}?t=tok-2`);
  });

  it("swaps the address when the same installation moves to a new entry", () => {
    render({ installId: "inst-1", entryUrl: ENTRY, token: "tok-1" });
    render({ installId: "inst-1", entryUrl: `${ENTRY}/v2`, token: "tok-1" });
    expect(src()).toBe(`${ENTRY}/v2?t=tok-1`);
  });
});

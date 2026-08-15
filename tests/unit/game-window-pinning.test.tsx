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

const install = (
  installId: string,
  token: string,
  entryUrl = ENTRY
): OverlayInstallation => ({
  installId,
  entryUrl,
  token,
  channelId: "chan-1",
  settings: {},
});

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
    render(install("inst-1", "tok-1"));
    const first = src();
    expect(first).toBe(`${ENTRY}?t=tok-1`);

    render(install("inst-1", "tok-2"));
    expect(src()).toBe(first);
  });

  it("swaps the address when a different overlay is installed", () => {
    render(install("inst-1", "tok-1"));
    render(install("inst-2", "tok-2"));
    expect(src()).toBe(`${ENTRY}?t=tok-2`);
  });

  it("swaps the address when the same installation moves to a new entry", () => {
    render(install("inst-1", "tok-1"));
    render(install("inst-1", "tok-1", `${ENTRY}/v2`));
    expect(src()).toBe(`${ENTRY}/v2?t=tok-1`);
  });

  // The whole point of pushing settings over the message channel is that a
  // change does not reload the frame. A changed address here would restart the
  // overlay and defeat it.
  it("holds the address when only the settings change", () => {
    render(install("inst-1", "tok-1"));
    const first = src();
    render({ ...install("inst-1", "tok-1"), settings: { scale: 2 } });
    expect(src()).toBe(first);
  });
});

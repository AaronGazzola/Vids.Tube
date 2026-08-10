// @vitest-environment happy-dom
import { GameWindow } from "@/components/overlay/game-window";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("what the game window paints with no game configured", () => {
  it("gives the layout editor an outline to position", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", "");
    const html = renderToStaticMarkup(<GameWindow placeholder />);
    expect(html).toContain("border-dashed");
    expect(html).toContain("Game");
  });

  it("gives the stream nothing", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(renderToStaticMarkup(<GameWindow />)).toBe("");
  });

  it("frames the game once an address is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", "https://game.example/rig");
    const html = renderToStaticMarkup(<GameWindow placeholder />);
    expect(html).toContain("https://game.example/rig");
    expect(html).not.toContain("border-dashed");
  });
});

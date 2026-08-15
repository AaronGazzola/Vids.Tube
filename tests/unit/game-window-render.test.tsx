// @vitest-environment happy-dom
import { GameWindow } from "@/components/overlay/game-window";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const PERMITTED = "https://game.example";
const ENTRY = `${PERMITTED}/rig`;
const INSTALLED = {
  installId: "inst-1",
  entryUrl: ENTRY,
  token: "tok-1",
  channelId: "chan-1",
  settings: {},
};

describe("what the game window paints", () => {
  it("gives the layout editor an outline to position with nothing installed", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", "");
    const html = renderToStaticMarkup(
      <GameWindow installation={null} placeholder />
    );
    expect(html).toContain("border-dashed");
    expect(html).toContain("Game");
  });

  it("gives the stream nothing with no overlay installed, and says so", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", ENTRY);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(renderToStaticMarkup(<GameWindow installation={null} />)).toBe("");
    expect(logged).toHaveBeenCalledOnce();
  });

  // A page load answers this question asynchronously. Reporting an empty box
  // before the answer arrives turns every load into a false alarm.
  it("says nothing while the installation is still being fetched", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", ENTRY);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(renderToStaticMarkup(<GameWindow installation={undefined} />)).toBe(
      ""
    );
    expect(logged).not.toHaveBeenCalled();
  });

  it("frames the installed overlay, carrying its token", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", ENTRY);
    const html = renderToStaticMarkup(
      <GameWindow
        installation={INSTALLED}
        placeholder
      />
    );
    expect(html).toContain(`${ENTRY}?t=tok-1`);
    expect(html).not.toContain("border-dashed");
  });

  it("gives the stream nothing when the installed overlay is hosted elsewhere", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", ENTRY);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToStaticMarkup(
      <GameWindow
        installation={{ ...INSTALLED, entryUrl: "https://elsewhere.example/rig" }}
      />
    );
    expect(html).toBe("");
  });

  it("gives the stream nothing when no origin is permitted", () => {
    vi.stubEnv("NEXT_PUBLIC_GAME_EMBED_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const html = renderToStaticMarkup(
      <GameWindow
        installation={INSTALLED}
      />
    );
    expect(html).toBe("");
  });
});

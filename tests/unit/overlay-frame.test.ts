import { describe, expect, it } from "vitest";
import { framedOverlayUrl } from "@/lib/overlay-frame";

const ORIGIN = "https://eco3d.shop";

describe("framedOverlayUrl", () => {
  it("appends the installation to a bare entry address", () => {
    expect(framedOverlayUrl(`${ORIGIN}/game/embed`, "abc", ORIGIN)).toBe(
      `${ORIGIN}/game/embed?install=abc`
    );
  });

  it("joins an existing query rather than replacing it", () => {
    expect(
      framedOverlayUrl(`${ORIGIN}/game/embed?rig=r1&legw=0.4`, "abc", ORIGIN)
    ).toBe(`${ORIGIN}/game/embed?rig=r1&legw=0.4&install=abc`);
  });

  it("keeps the fragment, which is where the rig configuration lives", () => {
    expect(
      framedOverlayUrl(`${ORIGIN}/game/embed#rig=r1&legw=0.4`, "abc", ORIGIN)
    ).toBe(`${ORIGIN}/game/embed?install=abc#rig=r1&legw=0.4`);
  });

  it("replaces an install parameter the entry address tried to set itself", () => {
    expect(
      framedOverlayUrl(`${ORIGIN}/game/embed?install=forged`, "abc", ORIGIN)
    ).toBe(`${ORIGIN}/game/embed?install=abc`);
  });

  it("refuses an origin other than the permitted one", () => {
    expect(
      framedOverlayUrl("https://elsewhere.example/game", "abc", ORIGIN)
    ).toBeNull();
  });

  it("refuses a different port on the permitted host", () => {
    expect(
      framedOverlayUrl("http://127.0.0.1:3002/game", "abc", "http://127.0.0.1:3000")
    ).toBeNull();
  });

  it("refuses an unparseable entry address", () => {
    expect(framedOverlayUrl("not a url", "abc", ORIGIN)).toBeNull();
  });

  it("refuses when the permitted origin is unset", () => {
    expect(framedOverlayUrl(`${ORIGIN}/game/embed`, "abc", "")).toBeNull();
  });

  it("refuses an empty installation id", () => {
    expect(framedOverlayUrl(`${ORIGIN}/game/embed`, "", ORIGIN)).toBeNull();
  });
});

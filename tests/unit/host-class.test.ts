import { describe, expect, it } from "vitest";
import { isHostMessage, pickHostChannelId, scorableOnly } from "@/lib/host-class";

const HOST = "UCENGTQuiakX7P7KwfakPlgg";
const VIEWER = "UCazeyI7uIS0UfqNAfiWaurQ";

describe("pickHostChannelId", () => {
  it("prefers the account recorded on the broadcast", () => {
    expect(pickHostChannelId(HOST, "UCsomethingelse")).toBe(HOST);
  });

  it("falls back to the community's account for older broadcasts", () => {
    expect(pickHostChannelId(null, HOST)).toBe(HOST);
  });

  it("returns nothing when neither is known", () => {
    expect(pickHostChannelId(null, null)).toBeNull();
  });
});

describe("isHostMessage", () => {
  it("recognises the streamer in their own chat", () => {
    expect(isHostMessage({ origin: "youtube", externalAuthorId: HOST }, HOST)).toBe(true);
  });

  it("does not mistake a viewer for the streamer", () => {
    expect(isHostMessage({ origin: "youtube", externalAuthorId: VIEWER }, HOST)).toBe(false);
  });

  it("never treats a bot as the streamer, even from the same account", () => {
    expect(
      isHostMessage({ origin: "bot", externalAuthorId: HOST, isBot: true }, HOST)
    ).toBe(false);
  });

  it("recognises nobody when the host account is unknown", () => {
    expect(isHostMessage({ origin: "youtube", externalAuthorId: HOST }, null)).toBe(false);
  });

  it("does not match a site-typed message with no external account", () => {
    expect(isHostMessage({ origin: "vidstube", externalAuthorId: null }, HOST)).toBe(false);
  });
});

describe("scorableOnly", () => {
  it("drops the host and keeps everyone else", () => {
    const batch = [
      { ref: "m0", isHost: true },
      { ref: "m1" },
      { ref: "m2", isHost: false },
    ];
    expect(scorableOnly(batch).map((m) => m.ref)).toEqual(["m1", "m2"]);
  });

  it("returns an empty batch when only the host spoke", () => {
    expect(scorableOnly([{ isHost: true }])).toHaveLength(0);
  });

  it("leaves a batch with no host untouched", () => {
    const batch = [{ ref: "m0", isHost: false }, { ref: "m1", isHost: false }];
    expect(scorableOnly(batch)).toHaveLength(2);
  });

  it("keeps the surviving order, so the model's refs still line up", () => {
    const batch = [
      { ref: "a" },
      { ref: "host", isHost: true },
      { ref: "b" },
      { ref: "c" },
    ];
    expect(scorableOnly(batch).map((m) => m.ref)).toEqual(["a", "b", "c"]);
  });
});

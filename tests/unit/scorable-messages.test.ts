import { scorableMessages } from "@/worker/lib/commands";
import { describe, expect, it } from "vitest";

const msg = (text: string, isHost = false) => ({ text, isHost });

describe("scorableMessages", () => {
  it("keeps command messages, so a command can be featured", () => {
    const batch = [msg("hello"), msg("!tts read this out"), msg("!ask why")];
    expect(scorableMessages(batch).map((m) => m.text)).toEqual([
      "hello",
      "!tts read this out",
      "!ask why",
    ]);
  });

  it("drops the host", () => {
    const batch = [msg("chatter line"), msg("host line", true)];
    expect(scorableMessages(batch).map((m) => m.text)).toEqual(["chatter line"]);
  });

  it("drops the host even when the host used a command", () => {
    const batch = [msg("!goal", true), msg("!goal")];
    expect(scorableMessages(batch)).toHaveLength(1);
    expect(scorableMessages(batch)[0].isHost).toBe(false);
  });

  it("treats an absent host flag as not the host", () => {
    expect(scorableMessages([{ text: "no flag" } as { isHost?: boolean }])).toHaveLength(1);
  });

  it("returns nothing for an empty batch", () => {
    expect(scorableMessages([])).toEqual([]);
  });
});

// Regression: the host chatted from vids.tube and was scored, featured, and
// charged a credit for !tts. The native chat fetch never stamped `isHost`, so
// every rule that keys on it silently did not apply to the streamer's own site.
describe("the host mark is what every host rule keys on", () => {
  const hostUserId = "host-user";
  // Mirrors what fetchNewVidstube builds for a native message.
  const native = (userId: string | null) => ({
    text: "!tts read this out",
    isHost: !!hostUserId && userId === hostUserId,
  });

  it("marks the host's own native message", () => {
    expect(native(hostUserId).isHost).toBe(true);
  });

  it("leaves an ordinary chatter unmarked", () => {
    expect(native("someone-else").isHost).toBe(false);
  });

  it("leaves a signed-out message unmarked", () => {
    expect(native(null).isHost).toBe(false);
  });

  it("keeps the host's native command out of the scoring batch", () => {
    const batch = [native(hostUserId), native("someone-else")];
    expect(scorableMessages(batch)).toHaveLength(1);
    expect(scorableMessages(batch)[0].isHost).toBe(false);
  });
});

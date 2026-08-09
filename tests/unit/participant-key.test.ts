import { describe, expect, it } from "vitest";
import { commandParticipantKey } from "@/worker/lib/commands";

describe("commandParticipantKey", () => {
  it("uses the Vids.Tube account even for a message that came from YouTube", () => {
    expect(
      commandParticipantKey({ userId: "user-1", externalAuthorId: "UCabc" })
    ).toBe("user-1");
  });

  it("falls back to the YouTube channel when no account is stamped", () => {
    expect(
      commandParticipantKey({ userId: null, externalAuthorId: "UCabc" })
    ).toBe("youtube:UCabc");
  });
});

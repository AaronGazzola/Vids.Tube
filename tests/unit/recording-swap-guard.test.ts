import { describe, expect, it } from "vitest";
import {
  refusalMessage,
  wouldDestroyLiveData,
} from "@/lib/recording-swap-guard";

describe("wouldDestroyLiveData", () => {
  it("refuses a broadcast that captured chat", () => {
    expect(
      wouldDestroyLiveData({
        chatMessages: 103,
        transcriptSegments: 0,
        membershipStats: 0,
      })
    ).toBe(true);
  });

  it("refuses a broadcast that captured a transcript", () => {
    expect(
      wouldDestroyLiveData({
        chatMessages: 0,
        transcriptSegments: 1222,
        membershipStats: 0,
      })
    ).toBe(true);
  });

  it("refuses a broadcast that produced membership records", () => {
    expect(
      wouldDestroyLiveData({
        chatMessages: 0,
        transcriptSegments: 0,
        membershipStats: 3,
      })
    ).toBe(true);
  });

  it("allows a broadcast that captured nothing, which is what the delete path was built for", () => {
    expect(
      wouldDestroyLiveData({
        chatMessages: 0,
        transcriptSegments: 0,
        membershipStats: 0,
      })
    ).toBe(false);
  });
});

describe("refusalMessage", () => {
  it("names what would have been destroyed and where to go instead", () => {
    const message = refusalMessage("2026-08-08", {
      chatMessages: 103,
      transcriptSegments: 1222,
      membershipStats: 3,
    });

    expect(message).toContain("103 chat messages");
    expect(message).toContain("1222 transcript segments");
    expect(message).toContain("3 membership records");
    expect(message).toContain("swap-recording.ts");
  });
});

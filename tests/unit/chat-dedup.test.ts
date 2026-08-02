import { describe, expect, it } from "vitest";
import {
  messageKey,
  normaliseBody,
  selectMissing,
  type CandidateMessage,
  type StoredMessage,
} from "@/lib/chat-dedup";

const AUTHOR = "UCazeyI7uIS0UfqNAfiWaurQ";
const OTHER = "UCciJYKAENpUu-MgWU1uSjlA";

const stored = (over: Partial<StoredMessage> = {}): StoredMessage => ({
  externalMessageId: "stored-1",
  externalAuthorId: AUTHOR,
  body: "hello there",
  createdAt: "2026-06-16T14:04:30.000Z",
  ...over,
});

const candidate = (over: Partial<CandidateMessage> = {}): CandidateMessage => ({
  messageId: "yt-1",
  authorChannelId: AUTHOR,
  body: "hello there",
  publishedAt: "2026-06-16T14:04:27.000Z",
  ...over,
});

describe("normaliseBody", () => {
  it("strips emoji shortcodes so an archived message matches its live copy", () => {
    expect(normaliseBody(":face_with_tears_of_joy:it feels weird")).toBe("it feels weird");
  });

  it("strips emoji characters so a live message matches its archived copy", () => {
    expect(normaliseBody("😂it feels weird")).toBe("it feels weird");
  });

  it("strips the zero-width characters Nightbot prepends", () => {
    expect(normaliseBody("​​hello")).toBe("hello");
  });

  it("collapses whitespace and case", () => {
    expect(normaliseBody("  Hello   THERE  ")).toBe("hello there");
  });

  it("reduces an emoji-only message to an empty string", () => {
    expect(normaliseBody("🎯")).toBe("");
    expect(normaliseBody(":bullseye:")).toBe("");
  });
});

describe("messageKey", () => {
  it("separates the same text from different authors", () => {
    expect(messageKey(AUTHOR, "gg")).not.toBe(messageKey(OTHER, "gg"));
  });

  it("treats an emoji shortcode and its character form as one message", () => {
    expect(messageKey(AUTHOR, "😂 nice")).toBe(messageKey(AUTHOR, ":joy: nice"));
  });
});

describe("selectMissing", () => {
  it("skips a candidate whose platform id is already stored", () => {
    const res = selectMissing(
      [candidate({ messageId: "yt-1" })],
      [stored({ externalMessageId: "yt-1", body: "totally different text" })]
    );
    expect(res.missing).toHaveLength(0);
    expect(res.matchedById).toBe(1);
  });

  it("skips a candidate stored under a different id scheme, matching on author and text", () => {
    const res = selectMissing(
      [candidate()],
      [stored({ externalMessageId: `${AUTHOR}:2026-06-16T14:04:30.000Z` })]
    );
    expect(res.missing).toHaveLength(0);
    expect(res.matchedByBody).toBe(1);
  });

  it("tolerates the few seconds of drift between the archive and the live poller", () => {
    const res = selectMissing(
      [candidate({ publishedAt: "2026-06-16T14:04:27.000Z" })],
      [stored({ createdAt: "2026-06-16T14:04:30.000Z" })]
    );
    expect(res.missing).toHaveLength(0);
  });

  it("keeps the same text sent again much later as a separate message", () => {
    const res = selectMissing(
      [candidate({ messageId: "yt-2", publishedAt: "2026-06-16T15:04:30.000Z" })],
      [stored()]
    );
    expect(res.missing).toHaveLength(1);
  });

  it("returns a candidate that was never stored", () => {
    const res = selectMissing([candidate({ body: "brand new message" })], [stored()]);
    expect(res.missing).toHaveLength(1);
    expect(res.matchedById).toBe(0);
    expect(res.matchedByBody).toBe(0);
  });

  it("does not insert the same candidate twice within one run", () => {
    const res = selectMissing(
      [candidate({ messageId: "yt-a" }), candidate({ messageId: "yt-b" })],
      []
    );
    expect(res.missing).toHaveLength(1);
  });

  it("uses a tighter window for emoji-only messages", () => {
    const near = selectMissing(
      [candidate({ body: ":bullseye:", publishedAt: "2026-06-16T14:04:20.000Z" })],
      [stored({ body: "🎯", createdAt: "2026-06-16T14:04:30.000Z" })]
    );
    expect(near.missing).toHaveLength(0);

    const far = selectMissing(
      [candidate({ body: ":bullseye:", publishedAt: "2026-06-16T14:05:30.000Z" })],
      [stored({ body: "🎯", createdAt: "2026-06-16T14:04:30.000Z" })]
    );
    expect(far.missing).toHaveLength(1);
  });

  it("keeps messages from different authors apart", () => {
    const res = selectMissing(
      [candidate({ authorChannelId: OTHER })],
      [stored({ externalAuthorId: AUTHOR })]
    );
    expect(res.missing).toHaveLength(1);
  });

  it("returns everything when nothing is stored", () => {
    const res = selectMissing(
      [candidate({ messageId: "a" }), candidate({ messageId: "b", body: "second" })],
      []
    );
    expect(res.missing).toHaveLength(2);
  });
});

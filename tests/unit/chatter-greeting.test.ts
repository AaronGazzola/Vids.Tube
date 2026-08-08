import { describe, expect, it } from "vitest";
import {
  BATCH_THRESHOLD,
  MAX_GREETING_CHARS,
  buildBatchGreeting,
  buildNewMemberGreeting,
  buildReturningGreeting,
  memberLink,
  siteLabel,
} from "@/worker/lib/chatter-greeting";

const COMMUNITY = "azanything";

describe("member link", () => {
  it("carries the scheme, because YouTube only renders links that have one", () => {
    expect(memberLink("kuroma", COMMUNITY)).toMatch(/^https:\/\//);
  });

  it("names the community as a query parameter, not a fragment", () => {
    const link = memberLink("kuroma", COMMUNITY);
    expect(link).toContain(`?c=${COMMUNITY}`);
    expect(link).not.toContain("#");
  });

  it("labels the bare address without a scheme for reading aloud", () => {
    expect(siteLabel()).not.toContain("://");
  });
});

describe("new member greeting", () => {
  it("states the member number and links to their own page", () => {
    const text = buildNewMemberGreeting({
      displayName: "Emre",
      handle: "emre_kzn",
      communitySlug: COMMUNITY,
      memberNumber: 144,
    });
    expect(text).toContain("@Emre");
    expect(text).toContain("144");
    expect(text).toContain(memberLink("emre_kzn", COMMUNITY));
  });

  it("carries exactly one link", () => {
    const text = buildNewMemberGreeting({
      displayName: "Emre",
      handle: "emre_kzn",
      communitySlug: COMMUNITY,
      memberNumber: 144,
    });
    expect(text.match(/https:\/\//g)).toHaveLength(1);
  });

  it("names the shared address instead when the handle is still a guess", () => {
    const text = buildNewMemberGreeting({
      displayName: "Emre",
      handle: null,
      communitySlug: COMMUNITY,
      memberNumber: 144,
    });
    expect(text).not.toContain("https://");
    expect(text).toContain(siteLabel());
  });

  it("does not double the mention prefix", () => {
    const text = buildNewMemberGreeting({
      displayName: "@Emre",
      handle: "emre_kzn",
      communitySlug: COMMUNITY,
      memberNumber: 1,
    });
    expect(text.startsWith("@Emre ")).toBe(true);
    expect(text).not.toContain("@@");
  });
});

describe("returning greeting", () => {
  const base = {
    displayName: "Kuroma",
    handle: "kuroma",
    communitySlug: COMMUNITY,
    messageCount: 1078,
    streamsAttended: 28,
    level: 8,
    credits: 163,
  };

  it("quotes the credits the member has banked", () => {
    const text = buildReturningGreeting({ ...base, shortLine: null });
    expect(text).toContain("163 credits");
  });

  it("says credit, not credits, for a balance of one", () => {
    const text = buildReturningGreeting({ ...base, shortLine: null, credits: 1 });
    expect(text).toContain("1 credit.");
    expect(text).not.toContain("1 credits");
  });

  it("says nothing about a balance of nothing", () => {
    const text = buildReturningGreeting({ ...base, shortLine: null, credits: 0 });
    expect(text).not.toContain("credit");
    expect(text).toContain(memberLink("kuroma", COMMUNITY));
  });

  it("uses the generated line when there is one", () => {
    const text = buildReturningGreeting({
      ...base,
      shortLine: "still the one asking the hard questions about the overlay.",
    });
    expect(text).toContain("still the one asking the hard questions");
    expect(text).toContain(memberLink("kuroma", COMMUNITY));
  });

  it("falls back to the member's own numbers when no line was generated", () => {
    const text = buildReturningGreeting({ ...base, shortLine: null });
    expect(text).toContain("1,078 messages");
    expect(text).toContain("28 streams");
    expect(text).toContain("level 8");
  });

  it("says stream, not streams, for a single broadcast", () => {
    const text = buildReturningGreeting({
      ...base,
      shortLine: null,
      streamsAttended: 1,
    });
    expect(text).toContain("1 stream,");
  });
});

describe("batch greeting", () => {
  it("names everyone and carries no personal link", () => {
    const text = buildBatchGreeting(
      ["Emre", "Alper", "Malek", "Creativez", "Zoe", "Sam"],
      144
    );
    expect(text).toContain("@Emre");
    expect(text).toContain("@Sam");
    expect(text).toContain("144");
    expect(text).not.toContain("https://");
    expect(text).toContain(siteLabel());
  });

  it("is only reached above the threshold", () => {
    expect(BATCH_THRESHOLD).toBe(5);
  });
});

describe("the 200-character limit", () => {
  // A greeting over the limit would be split by the chunker and arrive with its
  // link broken across two messages, so every variant is checked at its worst.
  const longName = "A".repeat(120);
  const longHandle = "b".repeat(60);
  const longLine = "words ".repeat(80);

  it("holds for a new member greeting with absurd inputs", () => {
    const text = buildNewMemberGreeting({
      displayName: longName,
      handle: longHandle,
      communitySlug: longHandle,
      memberNumber: 999999,
    });
    expect(text.length).toBeLessThanOrEqual(MAX_GREETING_CHARS);
  });

  it("holds for a returning greeting with a long generated line", () => {
    const text = buildReturningGreeting({
      displayName: "Kuroma",
      handle: "kuroma",
      communitySlug: COMMUNITY,
      shortLine: longLine,
      messageCount: 1078,
      streamsAttended: 28,
      level: 8,
      credits: 9999,
    });
    expect(text.length).toBeLessThanOrEqual(MAX_GREETING_CHARS);
    expect(text).toContain(memberLink("kuroma", COMMUNITY));
  });

  it("holds for a batch greeting naming many people", () => {
    const names = Array.from({ length: 40 }, (_, i) => `Chatter${i}`);
    const text = buildBatchGreeting(names, 500);
    expect(text.length).toBeLessThanOrEqual(MAX_GREETING_CHARS);
    expect(text).toContain(siteLabel());
  });

  it("keeps the link intact when the name is what has to be cut", () => {
    const text = buildReturningGreeting({
      displayName: "Kuroma",
      handle: "kuroma",
      communitySlug: COMMUNITY,
      shortLine: longLine,
      messageCount: 1,
      streamsAttended: 1,
      level: 0,
      credits: 12345,
    });
    expect(text.endsWith(memberLink("kuroma", COMMUNITY))).toBe(true);
  });
});

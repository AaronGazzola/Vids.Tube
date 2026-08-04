import { describe, expect, it } from "vitest";
import {
  matchesIdentity,
  summariseChat,
  type ChatRow,
} from "@/lib/chatter-stats";

const USER = "e64c4fed-0000-0000-0000-000000000000";
const YT = "UCazeyI7uIS0UfqNAfiWaurQ";

const row = (over: Partial<ChatRow> = {}): ChatRow => ({
  streamId: "s1",
  createdAt: "2026-06-16T14:00:00.000Z",
  userId: null,
  externalAuthorId: YT,
  ...over,
});

describe("matchesIdentity", () => {
  it("matches on the YouTube account when the identity is not linked", () => {
    expect(matchesIdentity(row(), { userId: null, youtubeChannelId: YT })).toBe(true);
  });

  it("matches on the user when the row carries one", () => {
    expect(
      matchesIdentity(row({ userId: USER, externalAuthorId: null }), {
        userId: USER,
        youtubeChannelId: null,
      })
    ).toBe(true);
  });

  it("does not match a different chatter", () => {
    expect(
      matchesIdentity(row({ externalAuthorId: "UCsomeoneelse" }), {
        userId: null,
        youtubeChannelId: YT,
      })
    ).toBe(false);
  });
});

describe("summariseChat", () => {
  const rows: ChatRow[] = [
    row({ streamId: "s1", createdAt: "2026-06-01T10:00:00.000Z" }),
    row({ streamId: "s1", createdAt: "2026-06-01T10:05:00.000Z" }),
    row({ streamId: "s2", createdAt: "2026-06-10T10:00:00.000Z" }),
    row({ streamId: "s3", createdAt: "2026-06-20T10:00:00.000Z", externalAuthorId: "UCother" }),
  ];

  it("counts only the identity's own messages", () => {
    const t = summariseChat(rows, { userId: null, youtubeChannelId: YT });
    expect(t.totalMessages).toBe(3);
  });

  it("counts distinct broadcasts rather than rows", () => {
    const t = summariseChat(rows, { userId: null, youtubeChannelId: YT });
    expect(t.videosAttended).toBe(2);
  });

  it("reports the earliest and latest moments seen", () => {
    const t = summariseChat(rows, { userId: null, youtubeChannelId: YT });
    expect(t.firstSeenAt).toBe("2026-06-01T10:00:00.000Z");
    expect(t.lastSeenAt).toBe("2026-06-10T10:00:00.000Z");
  });

  it("reports nothing for an identity with no history", () => {
    const t = summariseChat(rows, { userId: "nobody", youtubeChannelId: null });
    expect(t).toEqual({
      totalMessages: 0,
      videosAttended: 0,
      firstSeenAt: null,
      lastSeenAt: null,
    });
  });
});

// The identity merge attaches the owner's user id to the same rows that already
// carry their YouTube account. That is precisely the moment the old two-branch
// count broke, so it is the case worth pinning.
describe("linking an identity does not change the numbers", () => {
  const unlinked: ChatRow[] = [
    row({ streamId: "s1", createdAt: "2026-06-01T10:00:00.000Z" }),
    row({ streamId: "s2", createdAt: "2026-06-10T10:00:00.000Z" }),
  ];
  const linked: ChatRow[] = unlinked.map((r) => ({ ...r, userId: USER }));

  it("gives the same totals before and after the merge", () => {
    const before = summariseChat(unlinked, { userId: null, youtubeChannelId: YT });
    const after = summariseChat(linked, { userId: USER, youtubeChannelId: YT });
    expect(after).toEqual(before);
  });

  it("counts a row matching on both exactly once", () => {
    const t = summariseChat(linked, { userId: USER, youtubeChannelId: YT });
    expect(t.totalMessages).toBe(2);
  });

  it("gives the same totals whichever half of the identity is known", () => {
    const byUser = summariseChat(linked, { userId: USER, youtubeChannelId: null });
    const byAccount = summariseChat(linked, { userId: null, youtubeChannelId: YT });
    expect(byUser).toEqual(byAccount);
  });
});

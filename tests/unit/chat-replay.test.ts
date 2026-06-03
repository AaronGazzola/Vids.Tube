import { describe, expect, it } from "vitest";
import { toReplayMessages, visibleReplayMessages } from "@/lib/chat-replay";
import type { ChatReplay } from "@/app/watch/[videoId]/page.types";

const startedAt = "2026-06-01T00:00:00.000Z";

function row(id: string, secondsAfterStart: number, body = id) {
  return {
    id,
    user_id: `user-${id}`,
    body,
    created_at: new Date(
      new Date(startedAt).getTime() + secondsAfterStart * 1000
    ).toISOString(),
  };
}

describe("toReplayMessages", () => {
  it("computes offsets relative to the stream start", () => {
    const data: ChatReplay = {
      startedAt,
      messages: [row("a", 0), row("b", 5), row("c", 42)],
    };
    const result = toReplayMessages(data);
    expect(result.map((m) => m.offsetMs)).toEqual([0, 5_000, 42_000]);
    expect(result[0].userId).toBe("user-a");
  });

  it("clamps messages before the stream start to offset 0", () => {
    const data: ChatReplay = {
      startedAt,
      messages: [row("early", -10), row("later", 3)],
    };
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([0, 3_000]);
  });

  it("falls back to the earliest message when startedAt is null", () => {
    const data: ChatReplay = {
      startedAt: null,
      messages: [row("a", 100), row("b", 130)],
    };
    expect(toReplayMessages(data).map((m) => m.offsetMs)).toEqual([0, 30_000]);
  });

  it("returns an empty array when there are no messages", () => {
    expect(toReplayMessages({ startedAt, messages: [] })).toEqual([]);
  });
});

describe("visibleReplayMessages", () => {
  const messages = toReplayMessages({
    startedAt,
    messages: [row("a", 0), row("b", 5), row("c", 10)],
  });

  it("shows only messages at or before the current time", () => {
    expect(visibleReplayMessages(messages, 5_000).map((m) => m.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("re-filters to fewer messages when the playhead seeks backward", () => {
    expect(visibleReplayMessages(messages, 0).map((m) => m.id)).toEqual(["a"]);
  });

  it("shows all messages once the playhead passes the last offset", () => {
    expect(visibleReplayMessages(messages, 999_000)).toHaveLength(3);
  });
});

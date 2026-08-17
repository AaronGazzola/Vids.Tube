import { chatPanelView } from "@/app/(app)/live/panels";
import { describe, expect, it } from "vitest";

const chat = [
  { id: "a", body: "hello" },
  { id: "b", body: "the funny one" },
  { id: "c", body: "!tts read this out" },
];
const featured = (ids: string[]) => (id: string) => ids.includes(id);

describe("chatPanelView", () => {
  it("shows every message with the filter off", () => {
    const view = chatPanelView(chat, featured(["b"]), false);
    expect(view.rows.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(view.empty).toBeNull();
  });

  it("shows only featured messages with the filter on", () => {
    const view = chatPanelView(chat, featured(["b"]), true);
    expect(view.rows.map((m) => m.id)).toEqual(["b"]);
    expect(view.empty).toBeNull();
  });

  it("shows a featured command message", () => {
    const view = chatPanelView(chat, featured(["c"]), true);
    expect(view.rows.map((m) => m.id)).toEqual(["c"]);
  });

  it("says nothing is featured yet, not that chat is empty", () => {
    const view = chatPanelView(chat, featured([]), true);
    expect(view.rows).toEqual([]);
    expect(view.empty).toBe("nothing-featured");
  });

  it("says chat is empty when there is no chat, filter on or off", () => {
    expect(chatPanelView([], featured([]), true).empty).toBe("no-chat");
    expect(chatPanelView([], featured([]), false).empty).toBe("no-chat");
  });

  it("treats chat still loading as empty chat rather than as filtered out", () => {
    expect(chatPanelView(undefined, featured([]), true).empty).toBe("no-chat");
  });
});

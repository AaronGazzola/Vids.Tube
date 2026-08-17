import { groupGreetings, type GreetingRow } from "@/lib/greeting-groups";
import { describe, expect, it } from "vitest";

const author = (handle: string) => ({
  name: handle,
  handle,
  avatarUrl: null,
  avatarPath: null,
});

const row = (
  handle: string,
  kind: GreetingRow["kind"],
  greetedAt: string
): GreetingRow => ({
  channelId: `ch-${handle}`,
  kind,
  greetedAt,
  author: author(handle),
});

const T1 = "2026-08-16T10:00:00.000Z";
const T2 = "2026-08-16T10:05:00.000Z";

describe("groupGreetings", () => {
  it("makes one card for a single new arrival", () => {
    const groups = groupGreetings([row("ava", "new", T1)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("new");
    expect(groups[0].authors.map((a) => a.handle)).toEqual(["ava"]);
  });

  it("makes one card for a single returning arrival", () => {
    const groups = groupGreetings([row("ava", "returning", T1)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("returning");
  });

  it("makes one card for a burst claimed in the same pass", () => {
    const groups = groupGreetings([
      row("a", "batch", T1),
      row("b", "batch", T1),
      row("c", "batch", T1),
      row("d", "batch", T1),
      row("e", "batch", T1),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("batch");
    expect(groups[0].authors).toHaveLength(5);
  });

  it("keeps two bursts from different moments apart", () => {
    const groups = groupGreetings([
      row("a", "batch", T1),
      row("b", "batch", T1),
      row("c", "batch", T2),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].authors).toHaveLength(2);
    expect(groups[1].authors).toHaveLength(1);
  });

  it("does not merge individual greetings that share a moment", () => {
    const groups = groupGreetings([
      row("a", "new", T1),
      row("b", "new", T1),
      row("c", "returning", T1),
    ]);
    expect(groups).toHaveLength(3);
  });

  it("gives each group an id that is stable across polls", () => {
    const rows = [row("a", "new", T1), row("b", "batch", T2)];
    expect(groupGreetings(rows).map((g) => g.id)).toEqual(
      groupGreetings(rows).map((g) => g.id)
    );
  });

  it("returns nothing for no greetings", () => {
    expect(groupGreetings([])).toEqual([]);
  });

  it("carries the moment each group was greeted", () => {
    // The overlay filters on this to ignore everything that happened before it
    // loaded, which is what stops a browser-source refresh re-welcoming the
    // room.
    const groups = groupGreetings([row("a", "new", T1), row("b", "batch", T2)]);
    expect(groups.map((g) => g.greetedAt)).toEqual([T1, T2]);
  });

  it("lets a caller keep only what happened after a given moment", () => {
    const groups = groupGreetings([
      row("early", "new", T1),
      row("late", "new", T2),
    ]).filter((g) => Date.parse(g.greetedAt) > Date.parse(T1));
    expect(groups.map((g) => g.authors[0].handle)).toEqual(["late"]);
  });
});

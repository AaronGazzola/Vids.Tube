import { describe, expect, it } from "vitest";
import {
  canAddTask,
  diffTaskLists,
  hasTaskChanges,
  nextTaskStatus,
  parseTaskItems,
  sameTaskList,
  taskDraftToSaved,
  taskRevealFor,
  trimTaskDraft,
  type StreamTask,
  type TaskStatus,
} from "@/lib/stream-tasks";

function task(
  id: string,
  text: string,
  status: TaskStatus = "backlog"
): StreamTask {
  return { id, text, status };
}

describe("nextTaskStatus", () => {
  it("cycles through every status and wraps at canceled", () => {
    expect(nextTaskStatus("backlog")).toBe("todo");
    expect(nextTaskStatus("todo")).toBe("in_progress");
    expect(nextTaskStatus("in_progress")).toBe("completed");
    expect(nextTaskStatus("completed")).toBe("canceled");
    expect(nextTaskStatus("canceled")).toBe("backlog");
  });
});

describe("trimTaskDraft", () => {
  it("removes the last row when the bottom two are both empty", () => {
    const trimmed = trimTaskDraft([task("a", "ship it"), task("b", ""), task("c", "  ")]);
    expect(trimmed.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("leaves a single trailing empty row alone", () => {
    const list = [task("a", "ship it"), task("b", "")];
    expect(trimTaskDraft(list).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("leaves an empty row in the middle alone", () => {
    const list = [task("a", "ship it"), task("b", ""), task("c", "and this")];
    expect(trimTaskDraft(list).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("collapses a run of empty rows to one", () => {
    const list = [task("a", "ship it"), task("b", ""), task("c", ""), task("d", "")];
    expect(trimTaskDraft(list).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("keeps a lone empty row, which is the empty list's one row", () => {
    expect(trimTaskDraft([task("a", "")]).map((t) => t.id)).toEqual(["a"]);
  });
});

describe("canAddTask", () => {
  it("is hidden while the last row is empty", () => {
    expect(canAddTask([task("a", "ship it"), task("b", " ")])).toBe(false);
  });

  it("is shown once the last row has wording", () => {
    expect(canAddTask([task("a", "ship it")])).toBe(true);
  });

  it("is shown for an empty list", () => {
    expect(canAddTask([])).toBe(true);
  });
});

describe("taskDraftToSaved", () => {
  it("drops blank rows and trims the rest, keeping order", () => {
    const saved = taskDraftToSaved([
      task("a", "  ship it  ", "completed"),
      task("b", "   "),
      task("c", "then this"),
    ]);
    expect(saved).toEqual([
      { id: "a", text: "ship it", status: "completed" },
      { id: "c", text: "then this", status: "backlog" },
    ]);
  });
});

// What decides whether a save writes a version at all: an unchanged list must
// write nothing, or the overlay would reveal a list nobody edited.
describe("sameTaskList", () => {
  it("is true for the same list", () => {
    const list = [task("a", "ship it", "todo"), task("b", "then this")];
    expect(sameTaskList(list, [...list.map((t) => ({ ...t }))])).toBe(true);
  });

  it("is false when a status changed", () => {
    expect(
      sameTaskList([task("a", "ship it", "todo")], [task("a", "ship it", "completed")])
    ).toBe(false);
  });

  it("is false when the order changed", () => {
    const a = task("a", "first");
    const b = task("b", "second");
    expect(sameTaskList([a, b], [b, a])).toBe(false);
  });

  it("is false when wording changed", () => {
    expect(sameTaskList([task("a", "ship it")], [task("a", "ship this")])).toBe(
      false
    );
  });
});

describe("diffTaskLists", () => {
  it("reports a status change with the status it moved from", () => {
    const changes = diffTaskLists(
      [task("a", "ship it", "todo")],
      [task("a", "ship it", "completed")]
    );
    expect(changes).toEqual([
      { kind: "status", task: task("a", "ship it", "completed"), from: "todo" },
    ]);
  });

  it("treats reworded text with the same status as unchanged", () => {
    const changes = diffTaskLists(
      [task("a", "ship it", "todo")],
      [task("a", "ship this instead", "todo")]
    );
    expect(changes.map((c) => c.kind)).toEqual(["unchanged"]);
  });

  it("reports an added task once", () => {
    const changes = diffTaskLists([task("a", "ship it")], [
      task("a", "ship it"),
      task("b", "and this"),
    ]);
    expect(changes.filter((c) => c.kind === "added")).toHaveLength(1);
  });

  it("reports a removed task once", () => {
    const changes = diffTaskLists(
      [task("a", "ship it"), task("b", "and this")],
      [task("a", "ship it")]
    );
    expect(changes.filter((c) => c.kind === "removed")).toHaveLength(1);
  });

  it("reports every task unchanged when only the order moved", () => {
    const a = task("a", "first");
    const b = task("b", "second");
    const changes = diffTaskLists([a, b], [b, a]);
    expect(changes.every((c) => c.kind === "unchanged")).toBe(true);
    expect(hasTaskChanges(changes)).toBe(false);
  });

  it("reports every task as added for a broadcast's first list", () => {
    const changes = diffTaskLists([], [task("a", "ship it"), task("b", "then this")]);
    expect(changes.map((c) => c.kind)).toEqual(["added", "added"]);
    expect(hasTaskChanges(changes)).toBe(true);
  });
});

// The slot's decision: what the overlay reveals, and when it stays quiet.
describe("taskRevealFor", () => {
  const version = (id: string) => ({ id, items: [task("a", "ship it")] });

  it("reveals nothing for the version that was already newest at load", () => {
    const shown = { id: "v1" };
    expect(taskRevealFor(shown, version("v1"), false)).toBeNull();
  });

  it("reveals the newest version once it differs from the one last shown", () => {
    expect(taskRevealFor({ id: "v1" }, version("v2"), false)?.id).toBe("v2");
  });

  it("reveals nothing while the slot is busy", () => {
    expect(taskRevealFor({ id: "v1" }, version("v2"), true)).toBeNull();
  });

  it("goes from the version last shown to the newest, however many arrived", () => {
    // Two saves during one reveal: the second is what gets revealed next, and
    // the one in between is never shown on its own.
    const shown = { id: "v1" };
    expect(taskRevealFor(shown, version("v3"), false)?.id).toBe("v3");
  });

  it("reveals nothing before a version has been marked as shown", () => {
    expect(taskRevealFor(null, version("v1"), false)).toBeNull();
  });

  it("reveals nothing when the broadcast has saved no list", () => {
    expect(taskRevealFor({ id: null }, null, false)).toBeNull();
  });
});

describe("parseTaskItems", () => {
  it("reads stored rows back", () => {
    expect(
      parseTaskItems([{ id: "a", text: "ship it", status: "in_progress" }])
    ).toEqual([{ id: "a", text: "ship it", status: "in_progress" }]);
  });

  it("drops anything that is not a task", () => {
    expect(
      parseTaskItems([
        null,
        "nope",
        { id: 1, text: "wrong id", status: "todo" },
        { id: "b", text: "no status" },
        { id: "c", text: "bad status", status: "doing" },
        { id: "d", text: "fine", status: "todo" },
      ])
    ).toEqual([{ id: "d", text: "fine", status: "todo" }]);
  });

  it("reads a non-array as no tasks", () => {
    expect(parseTaskItems(null)).toEqual([]);
    expect(parseTaskItems({ id: "a" })).toEqual([]);
  });
});

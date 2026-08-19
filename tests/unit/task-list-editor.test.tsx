// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/browser-client", () => ({ supabase: {} }));

import { TaskListEditor } from "@/app/(app)/live/task-list-editor";
import { useTasksStore } from "@/app/(app)/live/tasks.stores";
import { taskDraftToSaved, type StreamTask } from "@/lib/stream-tasks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;
let host: HTMLElement | null = null;

const task = (id: string, text: string, status: StreamTask["status"] = "backlog") =>
  ({ id, text, status }) satisfies StreamTask;

const draft = () => useTasksStore.getState().tasks;

function mount(initial: StreamTask[]) {
  act(() => {
    useTasksStore.getState().seed("stream-1", initial);
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(<TaskListEditor />);
  });
}

const addButton = () =>
  Array.from(host!.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("New task")
  ) ?? null;

const statusButton = (n = 0) =>
  host!.querySelectorAll<HTMLButtonElement>('button[title]')[n];

const field = (n = 0) =>
  host!.querySelector<HTMLTextAreaElement>(`[aria-label="Task ${n + 1}"]`)!;

beforeEach(() => {
  act(() => {
    useTasksStore.getState().seed("stream-1", []);
  });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("TaskListEditor", () => {
  it("edits wording in a text area rather than an input", () => {
    mount([task("a", "ship it")]);
    expect(field(0).tagName).toBe("TEXTAREA");
    expect(Number(field(0).getAttribute("rows"))).toBe(1);
  });

  it("hides the add control while the last row is empty", () => {
    mount([task("a", "ship it")]);
    expect(addButton()).not.toBeNull();

    act(() => {
      addButton()!.click();
    });
    expect(draft()).toHaveLength(2);
    expect(addButton()).toBeNull();
  });

  it("cycles a status through all five states and back", () => {
    mount([task("a", "ship it")]);
    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      act(() => {
        statusButton(0).click();
      });
      seen.push(draft()[0].status);
    }
    expect(seen).toEqual([
      "todo",
      "in_progress",
      "completed",
      "canceled",
      "backlog",
    ]);
  });

  it("strikes out a canceled task and leaves a completed one plain", () => {
    mount([task("a", "dropped", "canceled"), task("b", "shipped", "completed")]);
    expect(field(0).className).toContain("line-through");
    expect(field(1).className).not.toContain("line-through");
  });

  it("keeps at most one empty row at the bottom", () => {
    mount([task("a", "ship it")]);
    act(() => {
      addButton()!.click();
    });
    // Typing into the new row and clearing it again must not stack up blanks.
    act(() => {
      useTasksStore.getState().setText(draft()[1].id, "then this");
    });
    act(() => {
      useTasksStore.getState().addTask();
    });
    act(() => {
      useTasksStore.getState().setText(draft()[1].id, "");
    });
    expect(draft().filter((t) => t.text.trim() === "")).toHaveLength(1);
  });

  it("saves the filled rows only, and not the trailing blank", () => {
    mount([task("a", "ship it", "completed")]);
    act(() => {
      addButton()!.click();
    });
    expect(taskDraftToSaved(draft())).toEqual([
      { id: "a", text: "ship it", status: "completed" },
    ]);
  });
});

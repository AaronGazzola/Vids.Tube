// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TASK_REVEAL_OPEN_MS,
  TaskListCard,
} from "@/components/overlay/task-list-card";
import type { StreamTask } from "@/lib/stream-tasks";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | null = null;
let host: HTMLElement | null = null;

const task = (
  id: string,
  text: string,
  status: StreamTask["status"] = "backlog"
): StreamTask => ({ id, text, status });

function mount(previous: StreamTask[], next: StreamTask[], onDone = () => {}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <TaskListCard previous={previous} next={next} onDone={onDone} />
    );
  });
}

const row = (id: string) =>
  host!.querySelector<HTMLElement>(`[data-task-id="${id}"]`)!;

const applied = () =>
  host!.querySelector<HTMLElement>('[data-testid="overlay-task-card"]')!.dataset
    .applied;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

describe("TaskListCard", () => {
  it("opens on the previous state, then applies every change at one moment", () => {
    mount(
      [task("a", "ship it", "todo"), task("b", "write tests", "backlog")],
      [
        task("a", "ship it", "completed"),
        task("b", "write tests", "todo"),
        task("c", "demo it", "backlog"),
      ]
    );

    // Before the change moment: the statuses the list had, and the added task
    // is not yet showing.
    expect(applied()).toBe("false");
    expect(row("a").dataset.status).toBe("todo");
    expect(row("b").dataset.status).toBe("backlog");
    expect(row("c").className).toContain("opacity-0");

    act(() => {
      vi.advanceTimersByTime(TASK_REVEAL_OPEN_MS);
    });

    expect(applied()).toBe("true");
    expect(row("a").dataset.status).toBe("completed");
    expect(row("b").dataset.status).toBe("todo");
    expect(row("c").className).toContain("opacity-100");
  });

  it("strikes out a canceled task and leaves a completed one plain", () => {
    mount(
      [task("a", "dropped", "todo"), task("b", "shipped", "todo")],
      [task("a", "dropped", "canceled"), task("b", "shipped", "completed")]
    );

    act(() => {
      vi.advanceTimersByTime(TASK_REVEAL_OPEN_MS);
    });

    // The tick is drawn first and the cross second, and both stay mounted so
    // one can fade into the other.
    const [canceledTick, canceledCross] = row("a").querySelectorAll("svg");
    expect(canceledCross.getAttribute("class")).toContain("opacity-100");
    expect(canceledTick.getAttribute("class")).toContain("opacity-0");
    expect(row("a").innerHTML).toContain("line-through");

    const [completedTick, completedCross] = row("b").querySelectorAll("svg");
    expect(completedTick.getAttribute("class")).toContain("opacity-100");
    expect(completedCross.getAttribute("class")).toContain("opacity-0");
    expect(row("b").innerHTML).not.toContain("line-through");
  });

  it("shows a removed task until the change moment", () => {
    mount([task("a", "ship it"), task("b", "drop this")], [task("a", "ship it")]);

    expect(row("b").className).toContain("opacity-100");
    act(() => {
      vi.advanceTimersByTime(TASK_REVEAL_OPEN_MS);
    });
    expect(row("b").className).toContain("opacity-0");
  });

  it("draws the list and finishes when nothing changed", () => {
    const list = [task("a", "ship it", "in_progress")];
    let done = false;
    mount(list, list, () => {
      done = true;
    });

    expect(row("a").dataset.change).toBe("unchanged");
    act(() => {
      vi.advanceTimersByTime(TASK_REVEAL_OPEN_MS);
    });
    expect(row("a").dataset.status).toBe("in_progress");

    // The envelope animation is what ends the reveal, and happy-dom does not
    // run animations, so the card is finished by the event the browser fires.
    act(() => {
      host!
        .querySelector('[data-testid="overlay-task-card"]')!
        .dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(done).toBe(true);
  });
});

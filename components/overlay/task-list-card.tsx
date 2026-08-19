"use client";

import {
  diffTaskLists,
  type StreamTask,
  type TaskChange,
  type TaskStatus,
} from "@/lib/stream-tasks";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// The task list, shown as a passing moment rather than a fixture: it opens on
// the list as it stood, applies every change at once, holds the new state, and
// leaves. The envelope (fade in, hold, fade out) is the shared `highlight-pop`
// animation every other card in this slot uses; the change moment is a state
// flip part-way through, so the differences animate as transitions rather than
// as a second set of keyframes to keep in step.

export const TASK_REVEAL_OPEN_MS = 1200;
export const TASK_REVEAL_HOLD_MS = 3200;
export const TASK_REVEAL_MS = TASK_REVEAL_OPEN_MS + TASK_REVEAL_HOLD_MS;

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

// Drawn rather than imported: an overlay is watched at a distance on someone
// else's screen, so the box, its tick and its cross are heavier than an icon
// set's. Both marks are always mounted and faded between, so a task going
// straight from completed to canceled swaps one for the other rather than
// popping.
function StatusBox({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-500",
        status === "backlog" && "border-white/35",
        status === "todo" && "border-white/80",
        status === "in_progress" && "border-blue-400",
        status === "completed" && "border-emerald-400 bg-emerald-400/20",
        status === "canceled" && "border-rose-400 bg-rose-400/20"
      )}
    >
      {status === "in_progress" && (
        <span className="size-2.5 rounded-full bg-blue-400" />
      )}
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={cn(
          "absolute size-4 text-emerald-300 transition-all duration-500",
          status === "completed" ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
      >
        <path
          d="M4 12.5 9.5 18 20 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={cn(
          "absolute size-4 text-rose-300 transition-all duration-500",
          status === "canceled" ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
      >
        <path
          d="M6 6 18 18M18 6 6 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function statusAt(change: TaskChange, applied: boolean): TaskStatus {
  if (change.kind === "status" && !applied) {
    return change.from;
  }
  return change.task.status;
}

function TaskRow({ change, applied }: { change: TaskChange; applied: boolean }) {
  const status = statusAt(change, applied);
  // An added row is not there to begin with; a removed row is there until the
  // change moment. Everything else is present throughout.
  const present =
    change.kind === "added" ? applied : change.kind === "removed" ? !applied : true;

  return (
    <li
      data-task-id={change.task.id}
      data-change={change.kind}
      data-status={status}
      className={cn(
        "flex items-start gap-2.5 overflow-hidden transition-all duration-500",
        present ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
      )}
    >
      <StatusBox status={status} />
      <span
        className={cn(
          "min-w-0 flex-1 break-words py-0.5 text-[22px] font-semibold leading-tight transition-all duration-500",
          "text-white",
          status === "completed" && "text-white/70",
          status === "canceled" && "text-white/50 line-through decoration-2",
          status === "backlog" && "text-white/70"
        )}
      >
        {change.task.text}
      </span>
      <span className="sr-only">{STATUS_LABEL[status]}</span>
    </li>
  );
}

export function TaskListCard({
  previous,
  next,
  onDone,
}: {
  previous: StreamTask[];
  next: StreamTask[];
  onDone: () => void;
}) {
  const [applied, setApplied] = useState(false);
  const changes = diffTaskLists(previous, next);

  useEffect(() => {
    const timer = setTimeout(() => setApplied(true), TASK_REVEAL_OPEN_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      data-testid="overlay-task-card"
      data-applied={applied}
      className="w-full px-3"
      style={{ animation: `highlight-pop ${TASK_REVEAL_MS}ms ease-in-out forwards` }}
      onAnimationEnd={onDone}
    >
      {/* Solid black behind a white frame, on the shared overlay surface so the
          owner's opacity slider still dims the backing without taking the text
          with it. */}
      <div
        className="overlay-surface rounded-2xl border border-white px-4 py-3 shadow-lg"
        style={{ "--overlay-surface-alpha": 1 } as React.CSSProperties}
      >
        <p className="pb-3 text-center text-3xl font-bold uppercase tracking-wide text-white/80">
          Tasks
        </p>
        <ul className="space-y-1.5">
          {changes.map((change) => (
            <TaskRow key={change.task.id} change={change} applied={applied} />
          ))}
        </ul>
      </div>
    </div>
  );
}

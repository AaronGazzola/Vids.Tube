// The task list a broadcast carries, and the handful of rules that decide what
// the editor shows and what a save writes. Kept away from React and from
// Supabase so the awkward parts — the trailing empty row, the status cycle —
// can be proven without either.

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "completed",
  "canceled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type StreamTask = {
  id: string;
  text: string;
  status: TaskStatus;
};

// The cycle order is the declaration order, so the button cannot drift from the
// list of statuses.
export function nextTaskStatus(status: TaskStatus): TaskStatus {
  const at = TASK_STATUSES.indexOf(status);
  return TASK_STATUSES[(at + 1) % TASK_STATUSES.length];
}

function isBlank(task: StreamTask): boolean {
  return task.text.trim() === "";
}

// At most one empty row at the bottom. A blank row further up is left alone: it
// is being typed into, or it is about to be, and removing it would take the
// cursor with it.
export function trimTaskDraft(list: StreamTask[]): StreamTask[] {
  const out = [...list];
  while (
    out.length >= 2 &&
    isBlank(out[out.length - 1]) &&
    isBlank(out[out.length - 2])
  ) {
    out.pop();
  }
  return out;
}

// Hides the add control rather than disabling it: an empty row at the bottom is
// already the thing the control would have added.
export function canAddTask(list: StreamTask[]): boolean {
  return list.length === 0 || !isBlank(list[list.length - 1]);
}

export function taskDraftToSaved(list: StreamTask[]): StreamTask[] {
  return list
    .filter((task) => !isBlank(task))
    .map((task) => ({ ...task, text: task.text.trim() }));
}

export function sameTaskList(a: StreamTask[], b: StreamTask[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// What the overlay animates. Worked out here from two saved versions rather
// than recorded at save time: the versions are already stored, and a stored
// "what changed" would be a second thing to keep true.
//
// Matched by identifier and never by wording, so retyping a task is a task
// whose wording changed rather than one task removed and another added.
export type TaskChange =
  | { kind: "unchanged"; task: StreamTask }
  | { kind: "added"; task: StreamTask }
  | { kind: "removed"; task: StreamTask }
  | { kind: "status"; task: StreamTask; from: TaskStatus };

export function diffTaskLists(
  previous: StreamTask[],
  next: StreamTask[]
): TaskChange[] {
  const before = new Map(previous.map((task) => [task.id, task]));
  const changes: TaskChange[] = next.map((task) => {
    const was = before.get(task.id);
    if (!was) {
      return { kind: "added", task };
    }
    if (was.status !== task.status) {
      return { kind: "status", task, from: was.status };
    }
    return { kind: "unchanged", task };
  });

  const kept = new Set(next.map((task) => task.id));
  for (const task of previous) {
    if (!kept.has(task.id)) {
      changes.push({ kind: "removed", task });
    }
  }
  return changes;
}

export function hasTaskChanges(changes: TaskChange[]): boolean {
  return changes.some((change) => change.kind !== "unchanged");
}

// Whether the overlay should reveal, given the version it last showed and the
// newest one saved. Three rules in one place, rather than three conditions
// spread through the slot:
//
//   - nothing is revealed while the slot is busy, so a reveal never interrupts
//     a highlight; it waits and goes afterwards
//   - nothing is revealed until a version has been marked as shown, which the
//     slot does on load — that is what stops a browser-source refresh replaying
//     the list
//   - the reveal is always from what was last shown to the newest version, so a
//     burst of saves collapses into one
export function taskRevealFor<T extends { id: string }>(
  shown: { id: string | null } | null,
  newest: T | null | undefined,
  slotBusy: boolean
): T | null {
  if (slotBusy || !shown || !newest) {
    return null;
  }
  return newest.id === shown.id ? null : newest;
}

// Stored as JSON, so what comes back is unknown until it has been checked. A
// row that does not match the shape is dropped rather than rendered as an
// empty task with no status.
export function parseTaskItems(value: unknown): StreamTask[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const { id, text, status } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof text !== "string") {
      return [];
    }
    if (!TASK_STATUSES.includes(status as TaskStatus)) {
      return [];
    }
    return [{ id, text, status: status as TaskStatus }];
  });
}

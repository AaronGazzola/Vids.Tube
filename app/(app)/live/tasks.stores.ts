"use client";

import { trimTaskDraft, type StreamTask, type TaskStatus } from "@/lib/stream-tasks";
import { create } from "zustand";

// The task list is edited as a draft and reaches the broadcast only when it is
// saved: by the Save changes press in the Settings tab, or by the Save control
// in the Activity tab popover. Both surfaces read this one draft, so a task
// typed in one is already there in the other.

type TasksState = {
  // The broadcast the draft belongs to. Held here so a draft can never be
  // saved onto a different broadcast than the one it was typed against.
  streamId: string | null;
  tasks: StreamTask[];
  seed: (streamId: string, tasks: StreamTask[]) => void;
  setTasks: (tasks: StreamTask[]) => void;
  setText: (id: string, text: string) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  addTask: () => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, toIndex: number) => void;
};

function newTask(): StreamTask {
  return { id: crypto.randomUUID(), text: "", status: "backlog" };
}

export const useTasksStore = create<TasksState>((set) => ({
  streamId: null,
  tasks: [],
  seed: (streamId, tasks) => set({ streamId, tasks: trimTaskDraft(tasks) }),
  setTasks: (tasks) => set({ tasks: trimTaskDraft(tasks) }),
  setText: (id, text) =>
    set((s) => ({
      tasks: trimTaskDraft(
        s.tasks.map((t) => (t.id === id ? { ...t, text } : t))
      ),
    })),
  setStatus: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
  addTask: () => set((s) => ({ tasks: [...s.tasks, newTask()] })),
  removeTask: (id) =>
    set((s) => ({ tasks: trimTaskDraft(s.tasks.filter((t) => t.id !== id)) })),
  moveTask: (id, toIndex) =>
    set((s) => {
      const from = s.tasks.findIndex((t) => t.id === id);
      if (from < 0 || toIndex < 0 || toIndex >= s.tasks.length || from === toIndex) {
        return s;
      }
      const next = [...s.tasks];
      const [moved] = next.splice(from, 1);
      next.splice(toIndex, 0, moved);
      return { tasks: trimTaskDraft(next) };
    }),
}));

"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  canAddTask,
  nextTaskStatus,
  type StreamTask,
  type TaskStatus,
} from "@/lib/stream-tasks";
import { cn } from "@/lib/utils";
import {
  Circle,
  CircleCheckBig,
  CircleDashed,
  CircleDot,
  CircleX,
  GripVertical,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { useTasksStore } from "./tasks.stores";

// One editor, rendered by both the Settings tab section and the Activity tab
// popover. It draws the rows and the add control and nothing else: each surface
// supplies its own Save, because each saves at a different moment.

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

const STATUS_ICON = {
  backlog: CircleDashed,
  todo: Circle,
  in_progress: CircleDot,
  completed: CircleCheckBig,
  canceled: CircleX,
} as const;

const STATUS_COLOUR: Record<TaskStatus, string> = {
  backlog: "text-muted-foreground",
  todo: "text-foreground",
  in_progress: "text-blue-500",
  completed: "text-emerald-500",
  canceled: "text-rose-500",
};

function StatusButton({
  task,
  onCycle,
}: {
  task: StreamTask;
  onCycle: () => void;
}) {
  const Icon = STATUS_ICON[task.status];
  return (
    <button
      type="button"
      onClick={onCycle}
      // The icon carries the meaning, so the status has to be in the label too.
      aria-label={`Status: ${STATUS_LABEL[task.status]}. Change to ${
        STATUS_LABEL[nextTaskStatus(task.status)]
      }`}
      title={STATUS_LABEL[task.status]}
      className={cn(
        "mt-1 shrink-0 rounded-md p-1 transition-colors hover:bg-accent",
        STATUS_COLOUR[task.status]
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function TaskListEditor({ className }: { className?: string }) {
  const tasks = useTasksStore((s) => s.tasks);
  const setText = useTasksStore((s) => s.setText);
  const setStatus = useTasksStore((s) => s.setStatus);
  const addTask = useTasksStore((s) => s.addTask);
  const moveTask = useTasksStore((s) => s.moveTask);

  // ponytail: native drag events, no drag-and-drop package. They do not fire
  // for touch; the control room is a desktop surface, and the up/down buttons
  // used by the overlay messages list are the fallback if that changes.
  const [dragId, setDragId] = useState<string | null>(null);
  const [handleHeld, setHandleHeld] = useState(false);

  return (
    <div className={cn("space-y-2", className)}>
      <ul className="divide-y rounded-md border">
        {tasks.map((task, index) => (
          <li
            key={task.id}
            draggable={handleHeld}
            onDragStart={() => setDragId(task.id)}
            onDragEnd={() => {
              setDragId(null);
              setHandleHeld(false);
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === task.id) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) moveTask(dragId, index);
              setDragId(null);
              setHandleHeld(false);
            }}
            className={cn(
              "flex items-start gap-1.5 px-1.5 py-1.5",
              dragId === task.id && "opacity-50"
            )}
          >
            <span
              onMouseDown={() => setHandleHeld(true)}
              onMouseUp={() => setHandleHeld(false)}
              aria-label="Drag to reorder"
              role="button"
              className="mt-1 shrink-0 cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </span>
            <Textarea
              rows={1}
              value={task.text}
              aria-label={`Task ${index + 1}`}
              placeholder="What is being worked on"
              onChange={(e) => setText(task.id, e.target.value)}
              className={cn(
                "min-h-0 resize-none border-0 py-1 shadow-none focus-visible:ring-0",
                task.status === "canceled" && "line-through opacity-70"
              )}
            />
            <StatusButton
              task={task}
              onCycle={() => setStatus(task.id, nextTaskStatus(task.status))}
            />
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="px-3 py-3 text-xs text-muted-foreground">
            No tasks yet.
          </li>
        )}
      </ul>
      {canAddTask(tasks) && (
        <Button size="sm" variant="outline" onClick={addTask}>
          <Plus className="size-4" />
          New task
        </Button>
      )}
    </div>
  );
}

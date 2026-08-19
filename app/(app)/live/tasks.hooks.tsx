"use client";

import { CustomToast } from "@/components/CustomToast";
import {
  sameTaskList,
  taskDraftToSaved,
  type StreamTask,
} from "@/lib/stream-tasks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  getPreviousBroadcastTasksAction,
  getStreamTasksAction,
  revealStreamTasksAction,
  saveStreamTasksAction,
} from "./tasks.actions";
import { useTasksStore } from "./tasks.stores";

export const streamTasksKey = (streamId: string | null) =>
  ["stream-tasks", streamId] as const;

export function useStreamTasks(streamId: string | null) {
  return useQuery({
    queryKey: streamTasksKey(streamId),
    queryFn: () => getStreamTasksAction(streamId as string),
    enabled: !!streamId,
  });
}

// Seeds the draft the first time a broadcast's saved list arrives, and again
// when the broadcast changes. A later refetch is ignored on purpose: it would
// otherwise wipe whatever is half-typed, the same trap the Settings form
// guards against.
export function useSeedTaskDraft(streamId: string | null) {
  const { data } = useStreamTasks(streamId);
  const draftStreamId = useTasksStore((s) => s.streamId);
  const seed = useTasksStore((s) => s.seed);

  useEffect(() => {
    if (!streamId || !data || draftStreamId === streamId) {
      return;
    }
    seed(streamId, data);
  }, [streamId, data, draftStreamId, seed]);
}

// True when the draft says something different from what is saved. Drives both
// the Settings tab's dirty state and whether the list may be shown on the
// overlay.
export function useTaskDraftPending(streamId: string | null): boolean {
  const { data } = useStreamTasks(streamId);
  const tasks = useTasksStore((s) => s.tasks);
  if (!streamId || !data) {
    return false;
  }
  return !sameTaskList(taskDraftToSaved(tasks), data);
}

export function useSaveStreamTasks(streamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tasks: StreamTask[]) => {
      const res = await saveStreamTasksAction(
        streamId as string,
        taskDraftToSaved(tasks)
      );
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: streamTasksKey(streamId) }),
    onError: (error: Error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't save the tasks"
          message={error.message}
        />
      ));
    },
  });
}

export function useRevealStreamTasks(streamId: string | null) {
  return useMutation({
    mutationFn: async () => {
      const res = await revealStreamTasksAction(streamId as string);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onError: (error: Error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't show the tasks"
          message={error.message}
        />
      ));
    },
  });
}

export function useCarryPreviousTasks(streamId: string | null) {
  const tasks = useTasksStore((s) => s.tasks);
  const setTasks = useTasksStore((s) => s.setTasks);
  return useMutation({
    mutationFn: () => getPreviousBroadcastTasksAction(streamId as string),
    onSuccess: (carried) => {
      if (carried.length === 0) {
        toast.custom(() => (
          <CustomToast
            variant="notification"
            title="Nothing to carry over"
            message="The previous broadcast has no unfinished tasks."
          />
        ));
        return;
      }
      const filled = tasks.filter((t) => t.text.trim() !== "");
      setTasks([...filled, ...carried]);
    },
    onError: (error: Error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't load the previous tasks"
          message={error.message}
        />
      ));
    },
  });
}

"use server";

import type { ActionResult } from "@/app/layout.types";
import {
  parseTaskItems,
  sameTaskList,
  type StreamTask,
} from "@/lib/stream-tasks";
import { createClient } from "@/supabase/server-client";

// Everything here goes through the row-level-security-bound client on purpose.
// The policies on `stream_task_versions` are the authorization: an owner reads
// and writes their own channel's versions and nobody else's. There is nothing
// for the service role to do here, and reaching for it would move the rule out
// of the database and into this one file.

type StreamRow = { id: string; channel_id: string; created_at: string };

async function loadStream(streamId: string): Promise<StreamRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("streams")
    .select("id, channel_id, created_at")
    .eq("id", streamId)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load the broadcast");
  }
  return data ?? null;
}

async function newestItems(streamId: string): Promise<StreamTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stream_task_versions")
    .select("items")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load the task list");
  }
  return parseTaskItems(data?.items);
}

export async function getStreamTasksAction(
  streamId: string
): Promise<StreamTask[]> {
  return newestItems(streamId);
}

export async function saveStreamTasksAction(
  streamId: string,
  items: StreamTask[]
): Promise<ActionResult<{ saved: boolean }>> {
  const stream = await loadStream(streamId);
  if (!stream) {
    return { error: "That broadcast no longer exists." };
  }

  // A save that changes nothing writes nothing. The overlay watches for new
  // versions, so writing one here would reveal a list nobody edited.
  const current = await newestItems(streamId);
  if (sameTaskList(current, items)) {
    return { data: { saved: false } };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stream_task_versions").insert({
    stream_id: stream.id,
    channel_id: stream.channel_id,
    items,
    reason: "saved",
  });
  if (error) {
    console.error(error);
    throw new Error("Failed to save the task list");
  }
  return { data: { saved: true } };
}

// Shows the saved list on the overlay again without changing it. Written as a
// version like any other, so the overlay has one thing to watch rather than a
// second channel for "show this now".
//
// It sends what is saved and never the draft: an unsaved edit is the owner
// thinking, and the audience is not shown that.
export async function revealStreamTasksAction(
  streamId: string
): Promise<ActionResult<{ shown: true }>> {
  const stream = await loadStream(streamId);
  if (!stream) {
    return { error: "That broadcast no longer exists." };
  }

  const items = await newestItems(streamId);
  if (items.length === 0) {
    return { error: "There are no saved tasks to show yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stream_task_versions").insert({
    stream_id: stream.id,
    channel_id: stream.channel_id,
    items,
    reason: "requested",
  });
  if (error) {
    console.error(error);
    throw new Error("Failed to show the task list");
  }
  return { data: { shown: true } };
}

// The unfinished tasks of the broadcast before this one, as new tasks. A
// carried task is deliberately not the same task: broadcasts each keep their
// own list, and nothing joins one list to the next.
export async function getPreviousBroadcastTasksAction(
  streamId: string
): Promise<StreamTask[]> {
  const stream = await loadStream(streamId);
  if (!stream) {
    return [];
  }

  const supabase = await createClient();
  const { data: previous, error } = await supabase
    .from("streams")
    .select("id")
    .eq("channel_id", stream.channel_id)
    .lt("created_at", stream.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load the previous broadcast");
  }
  if (!previous) {
    return [];
  }

  const items = await newestItems(previous.id);
  return items
    .filter((task) => task.status !== "completed" && task.status !== "canceled")
    .map((task) => ({ ...task, id: crypto.randomUUID() }));
}

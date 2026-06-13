"use server";

import type { ActionResult, Stream } from "@/app/layout.types";
import { uploadToR2 } from "@/lib/r2";
import { SCHEDULED_CLAIM_GRACE_MS } from "@/lib/stream";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

const THUMB_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_THUMB_SIZE = 5 * 1024 * 1024;

type OwnedChannel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  channel: { id: string };
};

async function getOwnedChannel(): Promise<ActionResult<OwnedChannel>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "No channel found for your account." };
  }

  return { data: { supabase, channel } };
}

export type BroadcastLists = {
  upcoming: Stream[];
  missed: Stream[];
  past: Stream[];
};

export async function listBroadcastsAction(): Promise<BroadcastLists> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  const { data, error } = await supabaseAdmin
    .from("streams")
    .select("*")
    .eq("channel_id", channel.id)
    .in("status", ["scheduled", "ended"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcasts");
  }

  const cutoff = Date.now() - SCHEDULED_CLAIM_GRACE_MS;
  const rows = data ?? [];

  const scheduled = rows.filter((row) => row.status === "scheduled");
  const isMissed = (row: Stream) =>
    !!row.scheduled_start_at &&
    new Date(row.scheduled_start_at).getTime() < cutoff;

  const upcoming = scheduled
    .filter((row) => !isMissed(row))
    .sort(
      (a, b) =>
        new Date(a.scheduled_start_at ?? 0).getTime() -
        new Date(b.scheduled_start_at ?? 0).getTime()
    );
  const missed = scheduled
    .filter(isMissed)
    .sort(
      (a, b) =>
        new Date(b.scheduled_start_at ?? 0).getTime() -
        new Date(a.scheduled_start_at ?? 0).getTime()
    );
  const past = rows.filter((row) => row.status === "ended");

  return { upcoming, missed, past };
}

export async function createScheduledBroadcastAction(input: {
  title: string;
  description: string;
  scheduledStartAt: string;
}): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const title = input.title.trim();
  if (!title) {
    return { error: "Add a title for the scheduled broadcast." };
  }
  if (!input.scheduledStartAt) {
    return { error: "Pick a start time for the scheduled broadcast." };
  }

  const { data, error } = await supabaseAdmin
    .from("streams")
    .insert({
      channel_id: channel.id,
      status: "scheduled",
      title,
      description: input.description.trim() || null,
      scheduled_start_at: new Date(input.scheduledStartAt).toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to create scheduled broadcast");
  }

  return { data: { id: data.id } };
}

export async function updateScheduledBroadcastAction(input: {
  id: string;
  title: string;
  description: string;
  scheduledStartAt: string;
}): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const title = input.title.trim();
  if (!title) {
    return { error: "A scheduled broadcast needs a title." };
  }
  if (!input.scheduledStartAt) {
    return { error: "Pick a start time for the scheduled broadcast." };
  }

  const { data, error } = await supabaseAdmin
    .from("streams")
    .update({
      title,
      description: input.description.trim() || null,
      scheduled_start_at: new Date(input.scheduledStartAt).toISOString(),
    })
    .eq("id", input.id)
    .eq("channel_id", channel.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to update scheduled broadcast");
  }
  if (!data) {
    return { error: "This broadcast can no longer be edited." };
  }

  return { data: { id: data.id } };
}

export async function cancelScheduledBroadcastAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data, error } = await supabaseAdmin
    .from("streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("channel_id", channel.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to cancel scheduled broadcast");
  }
  if (!data) {
    return { error: "This broadcast is no longer scheduled." };
  }

  return { data: { id: data.id } };
}

export async function uploadScheduledBroadcastThumbnailAction(
  formData: FormData
): Promise<ActionResult<string>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "No broadcast specified." };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided." };
  }
  const ext = THUMB_MIME_EXT[file.type];
  if (!ext) {
    return { error: "Unsupported file type — use JPG, PNG, or WebP." };
  }
  if (file.size > MAX_THUMB_SIZE) {
    return { error: "File too large — thumbnail must be 5 MB or smaller." };
  }

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status")
    .eq("id", id)
    .eq("channel_id", channel.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.status !== "scheduled") {
    return { error: "Only a scheduled broadcast can have its thumbnail set." };
  }

  const key = `live-thumb/${channel.id}/${stream.id}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await uploadToR2(key, bytes, file.type);
  } catch (uploadError) {
    console.error(uploadError);
    throw new Error("Failed to upload thumbnail");
  }

  const { error: updateError } = await supabaseAdmin
    .from("streams")
    .update({ thumbnail_path: key })
    .eq("id", stream.id);

  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to save thumbnail");
  }

  return { data: key };
}

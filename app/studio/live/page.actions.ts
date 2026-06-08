"use server";

import type { ActionResult, Stream } from "@/app/layout.types";
import { endBroadcastSession } from "@/lib/broadcast-end";
import { uploadToR2 } from "@/lib/r2";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";
import { randomBytes } from "crypto";

const THUMB_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_THUMB_SIZE = 5 * 1024 * 1024;

function generateStreamKey() {
  return `vt_live_${randomBytes(24).toString("hex")}`;
}

type OwnedChannel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  channel: { id: string; slug: string };
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
    .select("id, slug")
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

export async function getStreamKeyAction() {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { supabase, channel } = owned.data;

  const { data, error } = await supabase
    .from("stream_keys")
    .select("key")
    .eq("channel_id", channel.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load stream key");
  }

  return {
    channelId: channel.id,
    channelSlug: channel.slug,
    key: data?.key ?? null,
  };
}

export async function regenerateStreamKeyAction(): Promise<
  ActionResult<{ key: string }>
> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { supabase, channel } = owned.data;

  const key = generateStreamKey();
  const { error } = await supabase
    .from("stream_keys")
    .upsert({ channel_id: channel.id, key }, { onConflict: "channel_id" });

  if (error) {
    console.error(error);
    throw new Error("Failed to regenerate stream key");
  }

  return { data: { key } };
}

export async function getCurrentBroadcastAction(): Promise<Stream | null> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  const { data, error } = await supabaseAdmin
    .from("streams")
    .select("*")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }

  return data;
}

export async function goLiveAction(input: {
  title: string;
  description: string;
}): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const title = input.title.trim();
  if (!title) {
    return { error: "Add a title before going live." };
  }

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.status !== "preview") {
    return {
      error: "No connected stream to go live with. Start your encoder first.",
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from("streams")
    .update({
      status: "live",
      title,
      description: input.description.trim() || null,
    })
    .eq("id", stream.id)
    .eq("status", "preview");

  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to go live");
  }

  return { data: { id: stream.id } };
}

export async function endStreamAction(): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id, status, title, description, thumbnail_path")
    .eq("channel_id", channel.id)
    .in("status", ["preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream) {
    return { error: "No active broadcast to end." };
  }

  await endBroadcastSession(stream);

  return { data: { id: stream.id } };
}

export async function uploadBroadcastThumbnailAction(
  formData: FormData
): Promise<ActionResult<string>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

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
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || (stream.status !== "preview" && stream.status !== "live")) {
    return { error: "Start your encoder before setting a thumbnail." };
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

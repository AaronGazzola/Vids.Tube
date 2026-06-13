"use server";

import { createClient } from "@/supabase/server-client";
import { SCHEDULED_CLAIM_GRACE_MS, STALE_MS } from "@/lib/stream";
import type { ActionResult, Stream } from "@/app/layout.types";
import type { Channel, Video } from "./page.types";

export async function getUpcomingScheduledBroadcastAction(
  channelId: string
): Promise<Stream | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("channel_id", channelId)
    .in("status", ["scheduled", "preview"])
    .order("scheduled_start_at", { ascending: true });

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch scheduled broadcast");
  }

  const rows = data ?? [];
  const now = Date.now();

  const connectedPreview = rows
    .filter(
      (row) =>
        row.status === "preview" &&
        now - (row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0) <=
          STALE_MS
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

  if (connectedPreview) {
    return connectedPreview;
  }

  const upcoming = rows.find(
    (row) =>
      row.status === "scheduled" &&
      (!row.scheduled_start_at ||
        new Date(row.scheduled_start_at).getTime() >=
          now - SCHEDULED_CLAIM_GRACE_MS)
  );

  return upcoming ?? null;
}

export async function getChannelBySlugAction(
  slug: string
): Promise<Channel | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch channel");
  }

  return data;
}

export async function getChannelVideosAction(
  channelId: string
): Promise<Video[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channelId)
    .eq("status", "ready")
    .order("published_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch channel videos");
  }

  return data ?? [];
}

export async function getChannelProcessingVideosAction(
  channelId: string
): Promise<Video[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channelId)
    .in("status", ["processing", "failed"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch processing videos");
  }

  return data ?? [];
}

const BRANDING_BUCKET = "channel-assets";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE: Record<"avatar" | "banner", number> = {
  avatar: 2 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
};

export async function uploadChannelBrandingAction(
  channelId: string,
  kind: "avatar" | "banner",
  formData: FormData
): Promise<ActionResult<string>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(authError);
    return { error: "You must be signed in." };
  }
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .select("id, owner_user_id, avatar_path, banner_path")
    .eq("id", channelId)
    .maybeSingle();

  if (channelError) {
    console.error(channelError);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "Channel not found." };
  }
  if (channel.owner_user_id !== user.id) {
    return { error: "You're not authorized to edit this channel." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided." };
  }

  const ext = MIME_EXT[file.type];
  if (!ext) {
    return { error: "Unsupported file type — use JPG, PNG, or WebP." };
  }

  if (file.size > MAX_SIZE[kind]) {
    const limitMb = MAX_SIZE[kind] / (1024 * 1024);
    return {
      error: `File too large — ${kind} must be ${limitMb} MB or smaller.`,
    };
  }

  const path = `${channelId}/${kind}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    throw new Error("Failed to upload image");
  }

  const previousPath =
    kind === "avatar" ? channel.avatar_path : channel.banner_path;

  const update =
    kind === "avatar" ? { avatar_path: path } : { banner_path: path };

  const { error: updateError } = await supabase
    .from("channels")
    .update(update)
    .eq("id", channelId);

  if (updateError) {
    console.error(updateError);
    await supabase.storage.from(BRANDING_BUCKET).remove([path]);
    throw new Error("Failed to save image");
  }

  if (previousPath && previousPath !== path) {
    const { error: removeError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .remove([previousPath]);
    if (removeError) {
      console.error(removeError);
    }
  }

  return { data: path };
}

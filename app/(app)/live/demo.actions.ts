"use server";

import type { ActionResult } from "@/app/layout.types";
import { vodAssetUrl } from "@/lib/storage";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";
import {
  DEFAULT_DEMO_LAYOUT,
  mergeDemoLayout,
  type DemoLayoutConfig,
} from "./demo.types";

async function getOwnedChannelId(): Promise<ActionResult<string>> {
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
  return { data: channel.id };
}

// Returns null when the channel has no saved layout yet; the client falls back
// to the default for display only and never persists it unedited.
export async function getDemoLayoutAction(): Promise<DemoLayoutConfig | null> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { data, error } = await supabaseAdmin
    .from("overlay_layouts")
    .select("config")
    .eq("channel_id", owned.data)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load demo layout");
  }
  if (!data?.config) {
    return null;
  }
  return mergeDemoLayout(data.config as Partial<DemoLayoutConfig>);
}

export async function saveDemoLayoutAction(
  config: DemoLayoutConfig
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { error } = await supabaseAdmin.from("overlay_layouts").upsert(
    {
      channel_id: owned.data,
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel_id" }
  );
  if (error) {
    console.error(error);
    throw new Error("Failed to save demo layout");
  }
  return { data: { ok: true } };
}

function newOverlayToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getOverlayUrlInfoAction(): Promise<
  ActionResult<{ token: string }>
> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { data: existing, error } = await supabaseAdmin
    .from("overlay_layouts")
    .select("token")
    .eq("channel_id", owned.data)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load overlay token");
  }
  if (existing) {
    return { data: { token: existing.token } };
  }
  const token = newOverlayToken();
  const { error: insertError } = await supabaseAdmin
    .from("overlay_layouts")
    .insert({
      channel_id: owned.data,
      config: DEFAULT_DEMO_LAYOUT,
      token,
    });
  if (insertError) {
    console.error(insertError);
    throw new Error("Failed to create overlay layout");
  }
  return { data: { token } };
}

export async function regenerateOverlayTokenAction(): Promise<
  ActionResult<{ token: string }>
> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const token = newOverlayToken();
  const { error } = await supabaseAdmin
    .from("overlay_layouts")
    .update({ token, updated_at: new Date().toISOString() })
    .eq("channel_id", owned.data);
  if (error) {
    console.error(error);
    throw new Error("Failed to regenerate overlay token");
  }
  return { data: { token } };
}

const MAX_DEMO_FRAMES = 30;

// Frames for the demo slideshow: the channel's published VODs' extracted preview
// frames, falling back to each VOD's thumbnail. Same source as the video-card
// hover slideshow.
export async function getDemoFramesAction(): Promise<string[]> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return [];
  }
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("preview_paths, thumbnail_path, published_at, width, height")
    .eq("channel_id", owned.data)
    .eq("status", "ready")
    .order("published_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error(error);
    throw new Error("Failed to load demo frames");
  }

  // Vertical stream — only portrait VODs make sense as a backdrop.
  const portrait = (data ?? []).filter(
    (v) => (v.height ?? 0) > (v.width ?? 0)
  );

  const frames: string[] = [];
  for (const v of portrait) {
    const paths = v.preview_paths ?? [];
    if (paths.length) {
      for (const p of paths) {
        const url = vodAssetUrl(p);
        if (url) frames.push(url);
      }
    } else {
      const url = vodAssetUrl(v.thumbnail_path);
      if (url) frames.push(url);
    }
    if (frames.length >= MAX_DEMO_FRAMES) break;
  }
  return frames.slice(0, MAX_DEMO_FRAMES);
}

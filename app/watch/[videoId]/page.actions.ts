"use server";

import { createClient } from "@/supabase/server-client";
import type { Video } from "./page.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getVideoAction(videoId: string): Promise<Video | null> {
  if (!UUID_RE.test(videoId)) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("status", "ready")
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch video");
  }

  return data;
}

"use server";

import { createClient } from "@/supabase/server-client";

export type DemoVideo = {
  id: string;
  title: string | null;
  mp4_path: string | null;
};

export async function getOwnerVideosAction(): Promise<DemoVideo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!channel) {
    return [];
  }

  const { data, error } = await supabase
    .from("videos")
    .select("id, title, mp4_path")
    .eq("channel_id", channel.id)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error(error);
    throw new Error("Failed to load videos");
  }
  return data;
}

"use server";

import { createClient } from "@/supabase/server-client";
import type { Channel } from "./page.types";

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

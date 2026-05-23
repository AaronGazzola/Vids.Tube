"use server";

import { createClient } from "@/supabase/server-client";
import type { Channel } from "./page.types";

export async function getOwnerChannelAction(): Promise<Channel | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch channel");
  }

  return data;
}

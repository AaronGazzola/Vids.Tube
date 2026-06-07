import type { Database } from "@/supabase/types";
import type { User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type ActionResult<T> = { data: T } | { error: string };

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Stream = Database["public"]["Tables"]["streams"]["Row"];
export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];

export type ViewerCapState = "connecting" | "admitted" | "full";

export type CreateChannelInput = {
  handle: string;
  name?: string;
};

export type UpdateChannelInput = {
  channelId: string;
  name: string;
  handle: string;
  description: string;
};

export type HandleAvailability = {
  handle: string;
  available: boolean;
};

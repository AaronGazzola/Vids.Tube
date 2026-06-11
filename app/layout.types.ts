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

export type SignUpInput = {
  email: string;
  password: string;
  handle: string;
};

export type ActionResult<T> = { data: T } | { error: string };

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Stream = Database["public"]["Tables"]["streams"]["Row"];

export type AuthorIdentity = {
  handle: string;
  avatarPath: string | null;
} | null;

export type ChatMessageRow =
  Database["public"]["Tables"]["chat_messages"]["Row"];
export type ChatMessage = ChatMessageRow & { author: AuthorIdentity };

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

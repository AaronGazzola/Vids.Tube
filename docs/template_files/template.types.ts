import type { Database } from "@/supabase/types";

export type User = Database["public"]["Tables"]["users"]["Row"];

export type UserProfile = Database["public"]["Tables"]["profiles"]["Row"];

export type Post = Database["public"]["Tables"]["posts"]["Row"];

export type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];

export type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export type Comment = Database["public"]["Tables"]["comments"]["Row"];

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

export type LoginFormData = {
  email: string;
  password: string;
};

export type CreatePostFormData = {
  title: string;
  content: string;
  published: boolean;
};

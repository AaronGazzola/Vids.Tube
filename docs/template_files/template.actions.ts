"use server";

import { createClient } from "@/supabase/server-client";
import type { PostInsert, PostUpdate } from "./template.types";

export async function getUserProfileAction(userId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch user profile");
  }

  return data;
}

export async function createPostAction(post: PostInsert) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({ ...post, author_id: user.id })
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to create post");
  }

  return data;
}

export async function updatePostAction(postId: string, updates: PostUpdate) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase
    .from("posts")
    .update(updates)
    .eq("id", postId)
    .eq("author_id", user.id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Failed to update post");
  }

  return data;
}

export async function deletePostAction(postId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", user.id);

  if (error) {
    console.error(error);
    throw new Error("Failed to delete post");
  }

  return { success: true };
}

export async function getPostsAction(userId?: string) {
  const supabase = await createClient();

  let query = supabase.from("posts").select("*").order("created_at", { ascending: false });

  if (userId) {
    query = query.eq("author_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch posts");
  }

  return data;
}

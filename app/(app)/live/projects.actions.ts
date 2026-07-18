"use server";

import type { ActionResult } from "@/app/layout.types";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";

export type ChannelProject = {
  id: string;
  name: string;
  blurb: string | null;
  domainUrl: string | null;
  repoUrl: string | null;
  sortOrder: number;
};

export type ProjectInput = {
  name: string;
  blurb: string;
  domainUrl: string;
  repoUrl: string;
};

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

function validateProject(input: ProjectInput): ActionResult<{
  name: string;
  blurb: string | null;
  domain_url: string | null;
  repo_url: string | null;
}> {
  const name = input.name.trim();
  if (!name) {
    return { error: "A project name is required." };
  }
  for (const url of [input.domainUrl, input.repoUrl]) {
    if (url.trim() && !/^https?:\/\//.test(url.trim())) {
      return { error: "Links must start with http:// or https://." };
    }
  }
  return {
    data: {
      name,
      blurb: input.blurb.trim() || null,
      domain_url: input.domainUrl.trim() || null,
      repo_url: input.repoUrl.trim() || null,
    },
  };
}

export async function getChannelProjectsAction(): Promise<ChannelProject[]> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { data, error } = await supabaseAdmin
    .from("channel_projects")
    .select("id, name, blurb, domain_url, repo_url, sort_order")
    .eq("channel_id", owned.data)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error(error);
    throw new Error("Failed to load projects");
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    blurb: p.blurb,
    domainUrl: p.domain_url,
    repoUrl: p.repo_url,
    sortOrder: p.sort_order,
  }));
}

export async function createProjectAction(
  input: ProjectInput
): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const valid = validateProject(input);
  if ("error" in valid) {
    return valid;
  }
  const { data, error } = await supabaseAdmin
    .from("channel_projects")
    .insert({ channel_id: owned.data, ...valid.data })
    .select("id")
    .single();
  if (error) {
    console.error(error);
    throw new Error("Failed to create the project");
  }
  return { data: { id: data.id } };
}

export async function updateProjectAction(
  id: string,
  input: ProjectInput
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const valid = validateProject(input);
  if ("error" in valid) {
    return valid;
  }
  const { data, error } = await supabaseAdmin
    .from("channel_projects")
    .update({ ...valid.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("channel_id", owned.data)
    .select("id");
  if (error) {
    console.error(error);
    throw new Error("Failed to update the project");
  }
  if (!data?.length) {
    return { error: "Project not found." };
  }
  return { data: { ok: true } };
}

export async function deleteProjectAction(
  id: string
): Promise<ActionResult<{ ok: true }>> {
  const owned = await getOwnedChannelId();
  if ("error" in owned) {
    return owned;
  }
  const { error } = await supabaseAdmin
    .from("channel_projects")
    .delete()
    .eq("id", id)
    .eq("channel_id", owned.data);
  if (error) {
    console.error(error);
    throw new Error("Failed to delete the project");
  }
  return { data: { ok: true } };
}

import type { AuthorIdentity } from "@/app/layout.types";
import type { Database } from "@/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveAuthorIdentities(
  supabase: SupabaseClient<Database>,
  userIds: string[]
): Promise<Map<string, AuthorIdentity>> {
  const distinct = [...new Set(userIds)];
  if (distinct.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("channels")
    .select("owner_user_id, handle, avatar_path")
    .in("owner_user_id", distinct);

  if (error) {
    console.error(error);
    throw new Error("Failed to resolve author identities");
  }

  const map = new Map<string, AuthorIdentity>();
  for (const row of data ?? []) {
    map.set(row.owner_user_id, {
      handle: row.handle,
      avatarPath: row.avatar_path,
    });
  }
  return map;
}

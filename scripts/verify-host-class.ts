// Asserts the host participant class against production, and proves the
// database backstop rejects a duplicate community identity. The backstop case
// seeds inside a transaction and ROLLS BACK, so nothing is committed.
//
// The production assertions need only the service key:
//   doppler run -- npm run verify:host-class
// The backstop case additionally needs SUPABASE_ACCESS_TOKEN:
//   doppler run -c dev_personal -- npm run verify:host-class
import { createClient } from "@supabase/supabase-js";
import { PROJECT_REF } from "../supabase/config-api";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

const failures: string[] = [];
function check(ok: boolean, label: string, detail: string) {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
}

async function query(sql: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${API}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`query failed ${res.status}: ${JSON.stringify(body)}`);
  return Array.isArray(body) ? (body as Record<string, unknown>[]) : [];
}

async function main() {
  const { data: community } = await admin
    .from("channels")
    .select("id, slug, youtube_channel_id, owner_user_id")
    .not("owner_user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!community) throw new Error("no owned channel found");

  check(
    !!community.youtube_channel_id,
    "the community carries its YouTube account",
    community.youtube_channel_id ?? "not set"
  );

  const { data: mems } = await admin
    .from("memberships")
    .select("channel_id, community_channel_id");
  const self = (mems ?? []).filter((m) => m.channel_id === m.community_channel_id);
  check(self.length === 0, "no channel is a member of its own community", `${self.length} found`);

  const { data: channels } = await admin
    .from("channels")
    .select("id, slug, youtube_channel_id, owner_user_id");
  const { data: streams } = await admin.from("streams").select("channel_id");
  const communityIds = new Set((streams ?? []).map((s) => s.channel_id));
  const owned = new Set(
    (channels ?? [])
      .filter((c) => c.owner_user_id || communityIds.has(c.id))
      .map((c) => c.youtube_channel_id)
      .filter(Boolean)
  );
  const shadows = (channels ?? []).filter(
    (c) => !c.owner_user_id && c.youtube_channel_id && owned.has(c.youtube_channel_id)
  );
  check(
    shadows.length === 0,
    "no ownerless profile holds a community or claimed account",
    shadows.map((c) => `@${c.slug}`).join(", ") || "none"
  );

  if (community.youtube_channel_id) {
    const { count: hostScores } = await admin
      .from("viewer_scores")
      .select("*", { count: "exact", head: true })
      .eq("external_author_id", community.youtube_channel_id);
    check(hostScores === 0, "the host holds no per-broadcast scores", `${hostScores}`);

    const { count: hostRatings } = await admin
      .from("score_events")
      .select("*", { count: "exact", head: true })
      .eq("external_author_id", community.youtube_channel_id);
    check(hostRatings === 0, "the host holds no ratings", `${hostRatings}`);

    const { count: unattributed } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("external_author_id", community.youtube_channel_id)
      .is("user_id", null);
    check(
      unattributed === 0,
      "no host message is left unattributed",
      `${unattributed}`
    );
  }

  const { count: hostMembership } = await admin
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", community.id);
  check(hostMembership === 0, "the host holds no membership", `${hostMembership}`);

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.log(
      "\nskipping the backstop case — needs SUPABASE_ACCESS_TOKEN (run with -c dev_personal)"
    );
  } else {
    const ycid = community.youtube_channel_id ?? "UC_PROBE_NONE";
    const sql = `
begin;
do $probe$
begin
  insert into public.channels (slug, handle, name, youtube_channel_id)
  values ('probe_shadow', 'probe_shadow', 'Probe shadow', '${ycid}');
  raise exception 'the backstop did not fire';
exception
  when check_violation then
    null;
end
$probe$;
select 'rejected' as outcome;
rollback;`;
    try {
      const rows = await query(sql);
      const outcome = rows[rows.length - 1]?.outcome;
      check(
        outcome === "rejected",
        "the database rejects a duplicate community identity",
        String(outcome)
      );
    } catch (e) {
      check(false, "the database rejects a duplicate community identity", (e as Error).message.slice(0, 120));
    }
  }

  console.log(`\n${failures.length === 0 ? "all checks passed" : `${failures.length} failed`}`);
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Fails when a SECURITY DEFINER routine in the public schema is callable by a
// signed-out visitor. Such a routine bypasses row-level security by design, and
// PostgREST exposes anything `anon` can call at /rest/v1/rpc/<name>.
//
// Postgres grants EXECUTE on every new function to PUBLIC, and both `anon` and
// `authenticated` inherit it from there, so a migration that revokes those two
// roles by name reads as closed while the function stays reachable. The access
// list is therefore the evidence, not the migration text.
//
//   doppler run -c dev_personal -- npm run verify:routine-access

import { PROJECT_REF } from "../supabase/config-api";

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

// Routines that are deliberately callable, and by whom. The decision lives here,
// where it is enforced, rather than in a comment on a migration.
//
// is_participant_banned: the restrictive insert policy on chat_messages calls it,
// and a policy expression runs as the querying role, so revoking `authenticated`
// would deny every signed-in chat message.
type Role = "PUBLIC" | "anon" | "authenticated";

const ALLOWED: Record<string, Role[]> = {
  is_participant_banned: ["authenticated"],
};

type Routine = { proname: string; acl: string | null };

async function query(sql: string): Promise<Routine[]> {
  const res = await fetch(`${API}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`query failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return Array.isArray(body) ? (body as Routine[]) : [];
}

function grantees(acl: string | null): string[] {
  if (acl === null) return ["PUBLIC (default, never revoked)"];
  return acl
    .split(",")
    .map((entry) => entry.split("=")[0])
    .map((role) => (role === "" ? "PUBLIC" : role));
}

async function main() {
  const routines = await query(`
    select p.proname,
           array_to_string(p.proacl, ',') as acl
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
     order by p.proname
  `);

  if (routines.length === 0) {
    console.error("no SECURITY DEFINER routines found — the query is wrong, not the database");
    process.exit(1);
  }

  const failures: string[] = [];

  for (const routine of routines) {
    const allowed = ALLOWED[routine.proname] ?? [];
    const reachable = grantees(routine.acl).filter(
      (role) => role === "PUBLIC" || role === "anon" || role === "authenticated"
    );
    const unexpected = reachable.filter((role) => !allowed.includes(role));

    if (unexpected.length > 0) {
      failures.push(`${routine.proname} is callable by ${unexpected.join(", ")}`);
    }
    const missing = allowed.filter((role) => !reachable.includes(role));
    if (missing.length > 0) {
      failures.push(`${routine.proname} has lost its required grant to ${missing.join(", ")}`);
    }
  }

  console.log(`checked ${routines.length} SECURITY DEFINER routines in the public schema`);
  for (const failure of failures) console.log(`  FAIL ✗  ${failure}`);

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} routine grant(s) wrong. Revoke PUBLIC (not just anon and authenticated), ` +
        `or add the routine to ALLOWED in this script with the reason.`
    );
    process.exit(1);
  }
  console.log("  PASS  no routine is reachable by a signed-out visitor");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

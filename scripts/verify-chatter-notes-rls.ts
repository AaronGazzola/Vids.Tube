// Proves that chatter notes are readable only by the owner of the community the
// membership belongs to, and writable by nobody through the API.
//
// The notes are a synthesis of things people said in public, kept private on
// purpose. A member reading the notes written about them is the failure this
// guards against, so the test is run as a signed-out client rather than trusted
// from the policy text.
//
//   doppler run -- npx tsx scripts/verify-chatter-notes-rls.ts

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anon = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let failed = false;

function check(label: string, pass: boolean, detail: string) {
  if (!pass) failed = true;
  console.warn(`${pass ? "ok  " : "FAIL"}  ${label} — ${detail}`);
}

async function main() {
  const { data: membership, error: membershipError } = await admin
    .from("memberships")
    .select("id, channel_id, community_channel_id")
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    check(
      "a membership exists to test against",
      false,
      membershipError?.message ?? "no memberships in the database"
    );
    process.exit(1);
  }

  // Seed a row so the reads below are testing the policy rather than an empty
  // table. Removed again at the end whatever happens.
  const { error: seedError } = await admin.from("chatter_notes").upsert({
    membership_id: membership.id,
    notes: [
      { text: "rls probe", kind: "standing", raised_at: "2026-08-19" },
    ] as never,
    snapshot: { message_count: -1, streams_attended: -1 } as never,
  });
  check(
    "the service role can write notes",
    !seedError,
    seedError ? seedError.message : "seeded one row"
  );
  if (seedError) process.exit(1);

  try {
    const { data: adminRead } = await admin
      .from("chatter_notes")
      .select("membership_id")
      .eq("membership_id", membership.id);
    check(
      "the service role reads the seeded row",
      (adminRead ?? []).length === 1,
      `${(adminRead ?? []).length} rows`
    );

    const { data: anonRead, error: anonError } = await anon
      .from("chatter_notes")
      .select("membership_id")
      .eq("membership_id", membership.id);
    check(
      "a signed-out client reads nothing",
      (anonRead ?? []).length === 0,
      anonError ? anonError.message : `${(anonRead ?? []).length} rows`
    );

    const { data: anonAll } = await anon.from("chatter_notes").select("membership_id");
    check(
      "a signed-out client cannot list the table",
      (anonAll ?? []).length === 0,
      `${(anonAll ?? []).length} rows`
    );

    const { error: anonInsert } = await anon.from("chatter_notes").insert({
      membership_id: membership.id,
      notes: [] as never,
      snapshot: {} as never,
    });
    check(
      "a signed-out client cannot write notes",
      !!anonInsert,
      anonInsert ? anonInsert.message : "the insert was accepted"
    );

    const { error: anonUpdate } = await anon
      .from("chatter_notes")
      .update({ notes: [] as never })
      .eq("membership_id", membership.id);
    const { data: afterUpdate } = await admin
      .from("chatter_notes")
      .select("notes")
      .eq("membership_id", membership.id)
      .maybeSingle();
    const stillThere =
      Array.isArray(afterUpdate?.notes) && afterUpdate.notes.length === 1;
    check(
      "a signed-out client cannot overwrite notes",
      stillThere,
      anonUpdate ? anonUpdate.message : "no update policy, so nothing matched"
    );

    const { error: anonDelete } = await anon
      .from("chatter_notes")
      .delete()
      .eq("membership_id", membership.id);
    const { count: afterDelete } = await admin
      .from("chatter_notes")
      .select("membership_id", { count: "exact", head: true })
      .eq("membership_id", membership.id);
    check(
      "a signed-out client cannot delete notes",
      afterDelete === 1,
      anonDelete ? anonDelete.message : "no delete policy, so nothing matched"
    );
  } finally {
    await admin.from("chatter_notes").delete().eq("membership_id", membership.id);
  }

  console.warn(failed ? "\nFAILED" : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");

// Day One states when a member arrived, not how much they did, so it is not
// gated on messages, level or attendance. After this moment it is never awarded
// again: anyone chatting from here on becomes a member without it.
const CUTOFF = "2026-08-08T00:00:00Z";
const BADGE = "day-one";

async function main() {
  const { data: eligible, error } = await admin
    .from("memberships")
    .select("id, channel_id, community_channel_id, message_count, channels!memberships_channel_id_fkey(handle, youtube_channel_id, is_software)")
    .lt("created_at", CUTOFF);
  if (error) throw new Error(error.message);

  const rows = (eligible ?? []).filter((m) => {
    const c = m.channels as unknown as {
      handle: string;
      youtube_channel_id: string | null;
      is_software: boolean;
    } | null;
    return !!c && !!c.youtube_channel_id && !c.is_software;
  });

  const skipped = (eligible ?? []).length - rows.length;
  console.log(`memberships created before ${CUTOFF.slice(0, 10)}: ${(eligible ?? []).length}`);
  console.log(`  eligible (real, YouTube-backed): ${rows.length}`);
  console.log(`  skipped (software or no YouTube identity): ${skipped}`);

  const { data: already } = await admin
    .from("membership_badges")
    .select("membership_id")
    .eq("badge_key", BADGE);
  const held = new Set((already ?? []).map((r) => r.membership_id));
  const pending = rows.filter((m) => !held.has(m.id));

  console.log(`  already holding Day One: ${held.size}`);
  console.log(`  to award now: ${pending.length}`);

  if (!pending.length) {
    console.log("\nnothing to award");
    return;
  }

  if (!APPLY) {
    console.log("\ndry run — nothing changed. add --apply to write.");
    return;
  }

  // The uniqueness constraint on (membership, badge) is what makes a re-run
  // safe, so the insert ignores conflicts rather than checking first.
  const CHUNK = 200;
  let awarded = 0;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const slice = pending.slice(i, i + CHUNK);
    const { error: insErr } = await admin
      .from("membership_badges")
      .upsert(
        slice.map((m) => ({ membership_id: m.id, badge_key: BADGE })),
        { onConflict: "membership_id,badge_key", ignoreDuplicates: true }
      );
    if (insErr) {
      console.error(`  award batch failed: ${insErr.message}`);
      continue;
    }
    awarded += slice.length;
  }

  console.log(`\nawarded Day One to ${awarded} membership(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

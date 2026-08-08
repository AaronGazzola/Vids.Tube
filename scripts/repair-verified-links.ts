import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");

// Matches the codes the account page issues: six characters, no 0/1/I/O.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newVerifyCode(): string {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// A channel can end up carrying a YouTube identity without its verify-code row
// ever being marked verified: a repair or a merge can put the identity on the
// channel directly. The channel is the truth, so the link row is brought into
// line with it. Nothing here grants an identity — it only records one the
// channel already holds.
async function main() {
  const { data: channels, error } = await admin
    .from("channels")
    .select("id, handle, owner_user_id, youtube_channel_id")
    .not("owner_user_id", "is", null)
    .not("youtube_channel_id", "is", null);
  if (error) throw new Error(error.message);

  console.log(`claimed channels carrying a YouTube identity: ${channels?.length ?? 0}`);

  let repaired = 0;
  for (const c of channels ?? []) {
    const { data: link } = await admin
      .from("youtube_links")
      .select("user_id, youtube_channel_id, verified_at")
      .eq("user_id", c.owner_user_id!)
      .maybeSingle();

    const consistent =
      link?.verified_at && link.youtube_channel_id === c.youtube_channel_id;
    if (consistent) {
      console.log(`  @${c.handle}: already consistent`);
      continue;
    }

    // Never move an identity already verified to a different account.
    const { data: taken } = await admin
      .from("youtube_links")
      .select("user_id")
      .eq("youtube_channel_id", c.youtube_channel_id!)
      .not("verified_at", "is", null)
      .maybeSingle();
    if (taken && taken.user_id !== c.owner_user_id) {
      console.error(
        `  @${c.handle}: SKIPPED — that YouTube identity is verified to another account`
      );
      continue;
    }

    console.log(
      `  @${c.handle}: link row says ${link ? `${link.youtube_channel_id ?? "none"} / ${link.verified_at ?? "unverified"}` : "no row"} — channel says ${c.youtube_channel_id}`
    );
    if (!APPLY) {
      repaired += 1;
      continue;
    }

    const now = new Date().toISOString();
    // An existing row is updated rather than upserted: the insert path would
    // have to satisfy the not-null verify code, which the row already holds.
    const upErr = link
      ? (
          await admin
            .from("youtube_links")
            .update({
              youtube_channel_id: c.youtube_channel_id,
              youtube_handle: c.handle,
              verified_at: link.verified_at ?? now,
              updated_at: now,
            })
            .eq("user_id", c.owner_user_id!)
        ).error
      : (
          await admin.from("youtube_links").insert({
            user_id: c.owner_user_id!,
            youtube_channel_id: c.youtube_channel_id,
            youtube_handle: c.handle,
            verify_code: newVerifyCode(),
            verified_at: now,
            updated_at: now,
          })
        ).error;
    if (upErr) {
      console.error(`    repair failed: ${upErr.message}`);
      continue;
    }
    repaired += 1;
    console.log("    repaired");
  }

  console.log(
    APPLY
      ? `\nrepaired ${repaired} link row(s)`
      : `\ndry run — ${repaired} row(s) would be repaired. add --apply to write.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

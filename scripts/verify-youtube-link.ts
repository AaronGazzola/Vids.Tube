import { createClient } from "@supabase/supabase-js";
import { fetchChannelByHandle } from "../lib/youtube";
import type { BufferedMessage } from "../worker/jobs/score";
import { processLinkVerifications } from "../worker/lib/verify-links";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`OK: ${msg}`);
}

function youtubeMessage(
  text: string,
  externalAuthorId: string
): BufferedMessage {
  return {
    ref: "verify:test",
    origin: "youtube",
    author: "Verifier",
    text,
    userId: null,
    externalAuthorId,
    authorName: "Verifier",
    authorAvatarUrl: null,
    chatMessageId: null,
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const resolved = await fetchChannelByHandle("@YouTube");
  if (!resolved || !/^UC[\w-]{22}$/.test(resolved.channelId)) {
    fail(`handle resolution failed: ${JSON.stringify(resolved)}`);
  }
  ok(`resolved @YouTube -> ${resolved.channelId} (${resolved.title})`);

  const { data: owner } = await admin
    .from("channels")
    .select("owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!owner) fail("no channel");
  const userId = owner.owner_user_id;

  const { data: existing } = await admin
    .from("youtube_links")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const claimedChannel = "UC_VERIFY_TEST_CHANNEL";
  const code = "TESTA2";
  const seed = async () => {
    const { error } = await admin.from("youtube_links").upsert(
      {
        user_id: userId,
        youtube_channel_id: claimedChannel,
        youtube_handle: "verifytest",
        verify_code: code,
        verified_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) fail(error.message);
  };

  try {
    await seed();
    await processLinkVerifications([
      youtubeMessage(` ${code} `, claimedChannel),
    ]);
    let { data: row } = await admin
      .from("youtube_links")
      .select("verified_at")
      .eq("user_id", userId)
      .single();
    if (!row?.verified_at) fail("matching code from claimed channel did not verify");
    ok("code posted from the claimed channel verifies the link");

    await seed();
    await processLinkVerifications([
      youtubeMessage(code, "UC_SOMEONE_ELSE_ENTIRELY"),
    ]);
    ({ data: row } = await admin
      .from("youtube_links")
      .select("verified_at")
      .eq("user_id", userId)
      .single());
    if (row?.verified_at) fail("code from a different channel verified the link");
    ok("code posted by a different channel is ignored");
  } finally {
    if (existing) {
      await admin
        .from("youtube_links")
        .upsert(existing, { onConflict: "user_id" });
    } else {
      await admin.from("youtube_links").delete().eq("user_id", userId);
    }
    ok("cleaned up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

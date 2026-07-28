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
  externalAuthorId: string,
  authorName = "Poster"
): BufferedMessage {
  return {
    ref: "verify:test",
    origin: "youtube",
    author: authorName,
    text,
    userId: null,
    externalAuthorId,
    authorName,
    authorAvatarUrl: null,
    chatMessageId: null,
    createdAt: new Date().toISOString(),
  };
}

const suffix = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function mkUser(tag: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: `verify-link-${tag}-${suffix}@example.invalid`,
    password: `pw-${suffix}-${tag}`,
    email_confirm: true,
  });
  if (error || !data.user) fail(`createUser ${tag}: ${error?.message}`);
  return data.user!.id;
}

async function mkChannel(userId: string, tag: string): Promise<void> {
  const { error } = await admin.from("channels").insert({
    owner_user_id: userId,
    slug: `vlink_${tag}_${suffix}`,
    handle: `vlink_${tag}_${suffix}`.slice(0, 30),
    name: `Verify Link ${tag}`,
  });
  if (error) fail(`mkChannel ${tag}: ${error.message}`);
}

async function main() {
  const resolved = await fetchChannelByHandle("@YouTube");
  if (!resolved || !/^UC[\w-]{22}$/.test(resolved.channelId)) {
    fail(`handle resolution failed: ${JSON.stringify(resolved)}`);
  }
  ok(`resolved @YouTube -> ${resolved.channelId} (${resolved.title})`);

  const uA = await mkUser("a");
  const uB = await mkUser("b");
  const users = [uA, uB];
  const posterChannel = `UC_POSTER_${suffix}`;

  try {
    await mkChannel(uA, "a");
    await mkChannel(uB, "b");

    // Code-first: a code with no channel yet; the poster's channel is learned.
    const codeA = "AAA222";
    await admin.from("youtube_links").insert({
      user_id: uA,
      verify_code: codeA,
      updated_at: new Date().toISOString(),
    });
    await processLinkVerifications([
      youtubeMessage(codeA, posterChannel, "Poster A"),
    ]);
    const { data: rowA } = await admin
      .from("youtube_links")
      .select("verified_at, youtube_channel_id, youtube_handle")
      .eq("user_id", uA)
      .single();
    if (!rowA?.verified_at) fail("posting the code did not verify the link");
    if (rowA.youtube_channel_id !== posterChannel)
      fail(`channel not learned from poster: ${rowA.youtube_channel_id}`);
    ok("posting the code verifies and learns the poster's channel + handle");

    // Unknown code is ignored.
    const codeB = "BBB222";
    await admin.from("youtube_links").insert({
      user_id: uB,
      verify_code: codeB,
      updated_at: new Date().toISOString(),
    });
    await processLinkVerifications([
      youtubeMessage("ZZZ999", posterChannel, "Poster Z"),
    ]);
    const { data: rowB1 } = await admin
      .from("youtube_links")
      .select("verified_at")
      .eq("user_id", uB)
      .single();
    if (rowB1?.verified_at) fail("an unknown code verified a link");
    ok("a non-matching code is ignored");

    // A channel already verified-linked to another account cannot be re-linked.
    await processLinkVerifications([
      youtubeMessage(codeB, posterChannel, "Poster B"),
    ]);
    const { data: rowB2 } = await admin
      .from("youtube_links")
      .select("verified_at")
      .eq("user_id", uB)
      .single();
    if (rowB2?.verified_at)
      fail("a channel already linked elsewhere was re-linked");
    ok("a channel already linked to another account is ignored");
  } finally {
    for (const uid of users) {
      await admin.auth.admin.deleteUser(uid);
    }
    ok("cleaned up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

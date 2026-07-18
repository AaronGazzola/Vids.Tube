import { createClient } from "@supabase/supabase-js";
import type { BufferedMessage } from "../worker/jobs/score";
import { FIRST_TIMER_REPLY, meHandler } from "../worker/lib/me-command";
import type { CommandContext, CommandStreamInfo } from "../worker/lib/commands";
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

function ctxFor(
  stream: CommandStreamInfo,
  message: BufferedMessage
): { ctx: CommandContext; replies: string[] } {
  const replies: string[] = [];
  return {
    ctx: {
      stream,
      message,
      args: "",
      registry: [],
      reply: (text: string) => {
        replies.push(text);
      },
    },
    replies,
  };
}

async function main() {
  const { data: channel } = await admin
    .from("channels")
    .select("id, slug, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!channel) fail("no channel");
  const stream: CommandStreamInfo = {
    id: "00000000-0000-0000-0000-000000000000",
    channelId: channel.id,
    channelSlug: channel.slug,
  };

  const { data: knownChatter } = await admin
    .from("chatter_stats")
    .select("author_channel_id, author_name, total_messages")
    .order("total_messages", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!knownChatter) fail("no chatter_stats rows — run the backfill first");

  const knownKey = `youtube:${knownChatter.author_channel_id}`;
  await admin.from("me_profiles").delete().eq("profile_key", knownKey);

  const knownMessage: BufferedMessage = {
    ref: "me:test",
    origin: "youtube",
    author: knownChatter.author_name ?? "Chatter",
    text: "!me",
    userId: null,
    externalAuthorId: knownChatter.author_channel_id,
    authorName: knownChatter.author_name,
    authorAvatarUrl: null,
    chatMessageId: null,
    createdAt: new Date().toISOString(),
  };

  try {
    const first = ctxFor(stream, knownMessage);
    await meHandler(first.ctx);
    if (first.replies.length !== 1) fail("no reply for a known chatter");
    const bio = first.replies[0];
    if (bio.length > 400) fail(`bio exceeds 400 chars (${bio.length})`);
    if (bio.includes(FIRST_TIMER_REPLY)) fail("known chatter got the welcome");
    ok(`known chatter bio generated (${bio.length} chars): ${bio.slice(0, 90)}…`);

    const { data: profileRow } = await admin
      .from("me_profiles")
      .select("generated_at")
      .eq("profile_key", knownKey)
      .maybeSingle();
    if (!profileRow) fail("no me_profiles cache row written");
    ok("profile cached");

    const second = ctxFor(stream, knownMessage);
    await meHandler(second.ctx);
    const { data: profileRow2 } = await admin
      .from("me_profiles")
      .select("generated_at")
      .eq("profile_key", knownKey)
      .maybeSingle();
    if (profileRow2?.generated_at !== profileRow.generated_at) {
      fail("repeat call regenerated despite unchanged stats");
    }
    if (second.replies[0] !== bio) fail("cached reply differs");
    ok("repeat call served from cache (generated_at unchanged)");

    const fresh = ctxFor(stream, {
      ...knownMessage,
      author: "BrandNewViewer",
      authorName: "BrandNewViewer",
      externalAuthorId: "UC_ME_FIRST_TIMER_TEST",
    });
    await meHandler(fresh.ctx);
    if (!fresh.replies[0]?.includes(FIRST_TIMER_REPLY)) {
      fail(`first-timer did not get the welcome: ${fresh.replies[0]}`);
    }
    const { data: freshRow } = await admin
      .from("me_profiles")
      .select("profile_key")
      .eq("profile_key", "youtube:UC_ME_FIRST_TIMER_TEST")
      .maybeSingle();
    if (freshRow) fail("first-timer created a profile row");
    ok("first-timer welcome with no cache row");
  } finally {
    await admin.from("me_profiles").delete().eq("profile_key", knownKey);
    ok("cleaned up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

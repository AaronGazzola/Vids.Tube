// Exercises the whole greeting path against the real database without a live
// broadcast: onboarding, the membership recompute, the claim, the new-vs-
// returning branch, and the batch valve.
//
// Nightbot credentials are cleared before the worker modules load, so the send
// queue reports itself unconfigured and nothing reaches YouTube chat. Everything
// else runs exactly as it does live, including the bot message written to chat
// history — which is what gets read back and printed here.
delete process.env.NIGHTBOT_CHANNEL_SEND_TOKEN;
delete process.env.NIGHTBOT_REFRESH_TOKEN;
delete process.env.NIGHTBOT_CLIENT_ID;
delete process.env.NIGHTBOT_CLIENT_SECRET;

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import {
  BATCH_THRESHOLD,
  queuePendingGreeting,
  runChatterGreetings,
} from "../worker/lib/chatter-greeting";
import type { BufferedMessage } from "../worker/jobs/score";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const KEEP = process.argv.includes("--keep");
const BURST = process.argv.includes("--burst");
const BANNED = process.argv.includes("--banned");

function sample(name: string, ytId: string): BufferedMessage {
  return {
    ref: `youtube:${ytId}:dryrun`,
    origin: "youtube",
    author: name,
    text: "hello!",
    userId: null,
    externalAuthorId: ytId,
    authorName: name,
    authorAvatarUrl: null,
    chatMessageId: null,
    createdAt: new Date().toISOString(),
    isHost: false,
  };
}

async function main() {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug, handle")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!owner) throw new Error("no owner channel");

  const { data: stream, error: streamErr } = await admin
    .from("streams")
    .insert({
      channel_id: owner.id,
      title: "greeting dry run",
      status: "draft",
    })
    .select("id")
    .single();
  if (streamErr || !stream) throw new Error(streamErr?.message ?? "no stream");
  console.log(`temporary broadcast created on @${owner.handle}`);

  // Real members, so the returning branch has real history to draw on.
  const { data: memberships } = await admin
    .from("memberships")
    .select("channel_id, message_count")
    .eq("community_channel_id", owner.id)
    .order("message_count", { ascending: false })
    .limit(BURST ? BATCH_THRESHOLD + 2 : 2);
  const ids = (memberships ?? []).map((m) => m.channel_id);
  const { data: channels } = await admin
    .from("channels")
    .select("id, handle, name, youtube_channel_id, awaiting_enrichment")
    .in("id", ids);

  // The last one stands in as a first-timer, so the new-member branch is
  // exercised on a different channel — the queue holds one entry per chatter,
  // so reusing a channel would silently drop the second entry.
  const list = channels ?? [];
  const newcomer = BURST ? null : list[list.length - 1];
  for (const c of list) {
    queuePendingGreeting(stream.id, {
      channelId: c.id,
      handle: c.awaiting_enrichment ? null : c.handle,
      displayName: c.name,
      isNew: c.id === newcomer?.id,
      sample: sample(c.name, c.youtube_channel_id ?? "unknown"),
    });
  }

  console.log(
    `queued ${(channels ?? []).length} chatter(s)${BURST ? " (above the batch threshold)" : ""}\n`
  );

  // Greetings are queued during the chat poll, which runs before the batch is
  // moderated, so a ban has to be honoured by the greeting step itself.
  const bannedKeys = new Set<string>();
  if (BANNED) {
    for (const c of list) {
      if (c.youtube_channel_id) bannedKeys.add(`youtube:${c.youtube_channel_id}`);
    }
    console.log(`banned ${bannedKeys.size} of the queued chatter(s)\n`);
  }

  await runChatterGreetings({
    streamId: stream.id,
    communityId: owner.id,
    communitySlug: owner.slug,
    greetReturning: true,
    bannedKeys,
  });

  const { data: sent } = await admin
    .from("chat_messages")
    .select("body, created_at")
    .eq("stream_id", stream.id)
    .eq("origin", "bot")
    .order("created_at", { ascending: true });

  console.log(`--- ${(sent ?? []).length} greeting(s) composed ---`);
  for (const m of sent ?? []) {
    console.log(`[${String(m.body.length).padStart(3)}/200] ${m.body}`);
    if (m.body.length > 200) {
      console.error("  OVER THE LIMIT — this would be split in half by YouTube");
    }
    const links = m.body.match(/https:\/\/\S+/g) ?? [];
    console.log(`         links: ${links.length ? links.join(" ") : "none (shared address)"}`);
  }

  const { data: claims } = await admin
    .from("stream_greetings")
    .select("channel_id, kind")
    .eq("stream_id", stream.id);
  console.log(`\nclaims recorded: ${(claims ?? []).length}`);
  for (const c of claims ?? []) console.log(`  ${c.kind}`);

  // A second run must produce nothing: everyone waiting has already been claimed.
  await runChatterGreetings({
    streamId: stream.id,
    communityId: owner.id,
    communitySlug: owner.slug,
    greetReturning: true,
  });
  const { count: afterSecond } = await admin
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("stream_id", stream.id)
    .eq("origin", "bot");
  console.log(
    `\nafter a second pass: ${afterSecond} greeting(s) — ${afterSecond === (sent ?? []).length ? "unchanged, as expected" : "CHANGED, a chatter was greeted twice"}`
  );

  if (KEEP) {
    console.log(`\nkept broadcast ${stream.id} for inspection`);
    return;
  }
  await admin.from("streams").delete().eq("id", stream.id);
  console.log("\ntemporary broadcast removed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient<Database>(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(cond: boolean, msg: string) {
  console.log(`  ${cond ? "PASS" : "FAIL ✗"}  ${msg}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const { data: channel } = await admin
    .from("channels")
    .select("id, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!channel) {
    console.log("no channel — skipping");
    return;
  }

  const { data: stream } = await admin
    .from("streams")
    .insert({ channel_id: channel.id, status: "ended", title: "[MOD TEST]" })
    .select("id")
    .single();
  const streamId = stream!.id;

  try {
    console.log("=== 1. hide excludes from anon read ===");
    const { data: msg } = await admin
      .from("chat_messages")
      .insert({ stream_id: streamId, user_id: channel.owner_user_id, body: "mod test message" })
      .select("id")
      .single();
    const msgId = msg!.id;

    const before = await anon.from("chat_messages").select("id").eq("id", msgId).maybeSingle();
    assert(before.data?.id === msgId, "anon sees the message before hiding");

    await admin
      .from("chat_messages")
      .update({ hidden_at: new Date().toISOString(), hidden_by: "owner" })
      .eq("id", msgId);

    const afterAnon = await anon.from("chat_messages").select("id").eq("id", msgId).maybeSingle();
    assert(!afterAnon.data, "anon cannot read a hidden message (RLS)");

    const afterAdmin = await admin.from("chat_messages").select("id").eq("id", msgId).maybeSingle();
    assert(afterAdmin.data?.id === msgId, "service still sees the hidden message");

    console.log("\n=== 2. ban + is_participant_banned ===");
    await admin.from("banned_participants").insert({
      channel_id: channel.id,
      participant_key: channel.owner_user_id,
      origin: "vidstube",
      user_id: channel.owner_user_id,
      reason: "mod test",
      banned_by: "owner",
    });
    const banned = await admin.rpc("is_participant_banned", {
      p_user: channel.owner_user_id,
    });
    assert(banned.data === true, "is_participant_banned() returns true for a banned user");

    await admin
      .from("banned_participants")
      .delete()
      .eq("channel_id", channel.id)
      .eq("participant_key", channel.owner_user_id);
    const cleared = await admin.rpc("is_participant_banned", {
      p_user: channel.owner_user_id,
    });
    assert(cleared.data === false, "is_participant_banned() returns false after unban");

    console.log("\n=== 3. moderation_actions write/read (service) ===");
    const { error: maErr } = await admin.from("moderation_actions").insert({
      stream_id: streamId,
      target_kind: "message",
      action: "hide",
      chat_message_id: msgId,
      reason: "mod test",
      source: "owner",
      status: "applied",
    });
    assert(!maErr, `service insert moderation_actions ${maErr?.message ?? ""}`);
    const anonMa = await anon.from("moderation_actions").select("id").eq("stream_id", streamId);
    assert(
      (anonMa.data?.length ?? 0) === 0,
      "anon cannot read moderation_actions (no public policy)"
    );
  } finally {
    await admin.from("moderation_actions").delete().eq("stream_id", streamId);
    await admin.from("chat_messages").delete().eq("stream_id", streamId);
    await admin
      .from("banned_participants")
      .delete()
      .eq("channel_id", channel.id)
      .eq("participant_key", channel.owner_user_id);
    await admin.from("streams").delete().eq("id", streamId);
    console.log("\ncleaned up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

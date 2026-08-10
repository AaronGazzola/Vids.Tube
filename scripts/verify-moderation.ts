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

type Probe = {
  userId: string;
  channelId: string;
  client: ReturnType<typeof createClient<Database>>;
};

// A throwaway signed-in user, created with a pending handle so the signup trigger
// has something to do. The credentials are generated per run and never printed.
async function createProbeUser(): Promise<Probe | null> {
  const nonce = crypto.randomUUID().slice(0, 8);
  const email = `mod-probe-${nonce}@probe.invalid`;
  const password = crypto.randomUUID();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { pending_handle: `mod_probe_${nonce}` },
  });
  if (error || !created.user) {
    console.error("could not create the probe user:", error?.message);
    return null;
  }

  const { data: reserved } = await admin
    .from("channels")
    .select("id")
    .eq("owner_user_id", created.user.id)
    .maybeSingle();
  if (!reserved) {
    await admin.auth.admin.deleteUser(created.user.id);
    return null;
  }

  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("could not sign the probe user in:", signInError.message);
    await admin.from("channels").delete().eq("owner_user_id", created.user.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return null;
  }
  return { userId: created.user.id, channelId: reserved.id, client };
}

async function main() {
  let probe: Probe | null = null;
  let probeStreamId: string | null = null;

  const { data: channel } = await admin
    .from("channels")
    .select("id, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!channel || !channel.owner_user_id) {
    console.log("no owned channel — skipping");
    return;
  }
  const ownerUserId = channel.owner_user_id;

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
      .insert({ stream_id: streamId, user_id: ownerUserId, body: "mod test message" })
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
      participant_key: ownerUserId,
      origin: "vidstube",
      user_id: ownerUserId,
      reason: "mod test",
      banned_by: "owner",
    });
    const banned = await admin.rpc("is_participant_banned", {
      p_user: ownerUserId,
    });
    assert(banned.data === true, "is_participant_banned() returns true for a banned user");

    await admin
      .from("banned_participants")
      .delete()
      .eq("channel_id", channel.id)
      .eq("participant_key", ownerUserId);
    const cleared = await admin.rpc("is_participant_banned", {
      p_user: ownerUserId,
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

    // The restrictive insert policy on chat_messages calls is_participant_banned,
    // and a policy expression runs as the querying role. When EXECUTE on that
    // routine was revoked from PUBLIC, `authenticated` had to be granted it back
    // explicitly or every signed-in post would fail with a permission error.
    // Inserting as the service role would not exercise the policy at all, so the
    // probe below signs in as a real user.
    console.log("\n=== 4. a signed-in member can still post ===");
    probe = await createProbeUser();
    assert(!!probe, "creating a user reserves their handle (signup trigger fires with no grant)");
    if (probe) {
      // The stream is opened on the probe user's own channel, because a channel
      // may hold only one active stream and the owner's channel may already have
      // one.
      const { data: probeStream, error: openError } = await admin
        .from("streams")
        .insert({
          channel_id: probe.channelId,
          status: "preview",
          title: "[MOD TEST]",
          scheduled_start_at: new Date().toISOString(),
          waiting_room_chat: true,
        })
        .select("id")
        .single();
      assert(!!probeStream, `the probe stream accepts waiting-room chat ${openError?.message ?? ""}`);
      probeStreamId = probeStream?.id ?? null;

      if (probeStreamId) {
        const posted = await probe.client
          .from("chat_messages")
          .insert({ stream_id: probeStreamId, user_id: probe.userId, body: "grant probe" })
          .select("id")
          .single();
        assert(!posted.error, `a signed-in member posts ${posted.error?.message ?? ""}`);

        await admin.from("banned_participants").insert({
          channel_id: probe.channelId,
          participant_key: probe.userId,
          origin: "vidstube",
          user_id: probe.userId,
          reason: "grant probe",
          banned_by: "owner",
        });
        const blocked = await probe.client
          .from("chat_messages")
          .insert({ stream_id: probeStreamId, user_id: probe.userId, body: "grant probe banned" });
        assert(!!blocked.error, "a banned signed-in member is still refused by the policy");
      }
    }

    // Called with their real arguments, so a refusal cannot be confused with a
    // mistyped signature. A routine anon may not execute is absent from the API
    // schema anon is served, so "could not find" is the refusal.
    console.log("\n=== 5. revoked routines are closed to a signed-out caller ===");
    const spend = await anon.rpc("spend_credits", {
      p_membership_id: channel.id,
      p_amount: 1,
      p_kind: "tts",
      p_source_id: "grant probe",
    });
    assert(!!spend.error, `anon cannot spend credits (${spend.error?.message.slice(0, 60) ?? "ALLOWED"})`);

    const recompute = await anon.rpc("recompute_membership", {
      p_channel_id: channel.id,
      p_community_channel_id: channel.id,
    });
    assert(
      !!recompute.error,
      `anon cannot recompute a membership (${recompute.error?.message.slice(0, 60) ?? "ALLOWED"})`
    );
  } finally {
    if (probe) {
      await admin
        .from("banned_participants")
        .delete()
        .eq("channel_id", probe.channelId)
        .eq("participant_key", probe.userId);
      if (probeStreamId) {
        await admin.from("chat_messages").delete().eq("stream_id", probeStreamId);
        await admin.from("streams").delete().eq("id", probeStreamId);
      }
      await admin.from("channels").delete().eq("owner_user_id", probe.userId);
      await admin.auth.admin.deleteUser(probe.userId);
    }
    await admin.from("moderation_actions").delete().eq("stream_id", streamId);
    await admin.from("chat_messages").delete().eq("stream_id", streamId);
    await admin
      .from("banned_participants")
      .delete()
      .eq("channel_id", channel.id)
      .eq("participant_key", ownerUserId);
    await admin.from("streams").delete().eq("id", streamId);
    console.log("\ncleaned up");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

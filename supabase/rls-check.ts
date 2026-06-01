import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  }
}

async function run() {
  const stamp = Date.now();
  const emailA = `rls_a_${stamp}@test.local`;
  const emailB = `rls_b_${stamp}@test.local`;
  const password = "Password123!";

  const { data: a, error: aErr } = await admin.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (aErr || !a.user) throw aErr ?? new Error("failed to create user A");

  const { data: b, error: bErr } = await admin.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (bErr || !b.user) throw bErr ?? new Error("failed to create user B");

  const anon = createClient<Database>(url, publishableKey);
  const { error: anonReadErr } = await anon.from("channels").select("*");
  assert("anonymous can read channels", anonReadErr === null);

  const { error: anonStreamsErr } = await anon.from("streams").select("*");
  assert("anonymous can read streams", anonStreamsErr === null);

  const { error: anonChatErr } = await anon.from("chat_messages").select("*");
  assert("anonymous can read chat_messages", anonChatErr === null);

  const { data: anonKeys } = await anon.from("stream_keys").select("*");
  assert(
    "anonymous cannot read stream_keys (zero rows)",
    (anonKeys?.length ?? 0) === 0
  );

  const clientA = createClient<Database>(url, publishableKey);
  const { error: signInErr } = await clientA.auth.signInWithPassword({
    email: emailA,
    password,
  });
  if (signInErr) throw signInErr;

  const { error: ownInsertErr } = await clientA.from("channels").insert({
    owner_user_id: a.user.id,
    slug: `rls_own_${stamp}`,
    name: "User A channel",
  });
  assert("owner can insert their own channel", ownInsertErr === null);

  const { error: crossInsertErr } = await clientA.from("channels").insert({
    owner_user_id: b.user.id,
    slug: `rls_cross_${stamp}`,
    name: "Should fail",
  });
  assert("cross-user insert is rejected", crossInsertErr !== null);

  const { data: nonOwnerKeys } = await clientA.from("stream_keys").select("*");
  assert(
    "non-owner authenticated user cannot read stream_keys (zero rows)",
    (nonOwnerKeys?.length ?? 0) === 0
  );

  const { data: ownerStream, error: ownerStreamErr } = await admin
    .from("streams")
    .select("id")
    .eq("status", "idle")
    .limit(1)
    .maybeSingle();
  if (ownerStreamErr) throw ownerStreamErr;

  if (ownerStream) {
    const { data: selfMsg, error: selfMsgErr } = await clientA
      .from("chat_messages")
      .insert({
        stream_id: ownerStream.id,
        user_id: a.user.id,
        body: `rls self ${stamp}`,
      })
      .select("id")
      .maybeSingle();
    assert("authenticated user can post chat as themselves", selfMsgErr === null);

    const { error: spoofMsgErr } = await clientA.from("chat_messages").insert({
      stream_id: ownerStream.id,
      user_id: b.user.id,
      body: `rls spoof ${stamp}`,
    });
    assert("posting chat as another user is rejected", spoofMsgErr !== null);

    if (selfMsg) await admin.from("chat_messages").delete().eq("id", selfMsg.id);
  } else {
    console.log("SKIP: no idle stream present to test chat insert (run seed)");
  }

  const { data: anyChannel } = await admin
    .from("channels")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (anyChannel) {
    const { data: readyVid } = await admin
      .from("videos")
      .insert({
        channel_id: anyChannel.id,
        status: "ready",
        title: `rls ready ${stamp}`,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const { data: procVid } = await admin
      .from("videos")
      .insert({
        channel_id: anyChannel.id,
        status: "processing",
        title: `rls proc ${stamp}`,
      })
      .select("id")
      .single();

    const { data: anonVideos } = await anon.from("videos").select("id, status");
    assert(
      "anonymous sees ready video",
      (anonVideos ?? []).some((v) => v.id === readyVid?.id)
    );
    assert(
      "anonymous does not see processing video",
      !(anonVideos ?? []).some((v) => v.id === procVid?.id)
    );

    const { data: authVideos } = await clientA
      .from("videos")
      .select("id, status");
    assert(
      "authenticated user does not see processing video",
      !(authVideos ?? []).some((v) => v.id === procVid?.id)
    );

    const { error: vidInsertErr } = await clientA.from("videos").insert({
      channel_id: anyChannel.id,
      status: "ready",
      title: "should fail",
    });
    assert("client insert into videos is rejected", vidInsertErr !== null);

    const { data: updRows } = await clientA
      .from("videos")
      .update({ title: "hacked" })
      .eq("id", readyVid?.id ?? "")
      .select("id");
    assert(
      "client update on videos affects no rows",
      (updRows?.length ?? 0) === 0
    );

    if (readyVid) await admin.from("videos").delete().eq("id", readyVid.id);
    if (procVid) await admin.from("videos").delete().eq("id", procVid.id);
  } else {
    console.log("SKIP: no channel present to test videos RLS (run seed)");
  }

  const { data: ownedChannel } = await admin
    .from("channels")
    .select("id")
    .eq("owner_user_id", a.user.id)
    .limit(1)
    .maybeSingle();

  if (ownedChannel) {
    const ownerPath = `${ownedChannel.id}/avatar-${stamp}.png`;
    const fileBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    const { error: ownerUploadErr } = await clientA.storage
      .from("channel-assets")
      .upload(ownerPath, fileBytes, { contentType: "image/png", upsert: false });
    assert(
      "channel owner can upload to their channel-assets folder",
      ownerUploadErr === null
    );

    const publicUrl = `${url}/storage/v1/object/public/channel-assets/${ownerPath}`;
    const publicGet = await fetch(publicUrl);
    assert(
      "uploaded channel asset is publicly readable",
      publicGet.status === 200
    );

    const { data: bChannel } = await admin
      .from("channels")
      .insert({
        owner_user_id: b.user.id,
        slug: `rls_b_chan_${stamp}`,
        name: "User B channel",
      })
      .select("id")
      .single();

    if (bChannel) {
      const { error: crossUploadErr } = await clientA.storage
        .from("channel-assets")
        .upload(`${bChannel.id}/avatar-${stamp}.png`, fileBytes, {
          contentType: "image/png",
          upsert: true,
        });
      assert(
        "user cannot upload to a channel they do not own",
        crossUploadErr !== null
      );
    }

    const { error: anonUploadErr } = await anon.storage
      .from("channel-assets")
      .upload(`${ownedChannel.id}/banner-${stamp}.png`, fileBytes, {
        contentType: "image/png",
        upsert: true,
      });
    assert(
      "anonymous user cannot upload to channel-assets",
      anonUploadErr !== null
    );

    await admin.storage.from("channel-assets").remove([ownerPath]);
  } else {
    console.log("SKIP: no owned channel for user A to test storage RLS");
  }

  await admin.from("channels").delete().eq("owner_user_id", a.user.id);
  await admin.auth.admin.deleteUser(a.user.id);
  await admin.auth.admin.deleteUser(b.user.id);
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("RLS check failed:", error);
    process.exit(1);
  });

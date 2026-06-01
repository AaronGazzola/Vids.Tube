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
  const emailA = `vodux_a_${stamp}@test.local`;
  const emailB = `vodux_b_${stamp}@test.local`;
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

  const { data: anyChannel } = await admin
    .from("channels")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!anyChannel) {
    console.log("SKIP: no channel present (run seed)");
    await admin.auth.admin.deleteUser(a.user.id);
    await admin.auth.admin.deleteUser(b.user.id);
    return;
  }

  const { data: vid, error: vidErr } = await admin
    .from("videos")
    .insert({
      channel_id: anyChannel.id,
      status: "ready",
      title: `vod-ux ${stamp}`,
      published_at: new Date().toISOString(),
      width: 1920,
      height: 1080,
      preview_paths: [
        `vod/test/preview-${stamp}-1.jpg`,
        `vod/test/preview-${stamp}-2.jpg`,
      ],
    })
    .select("id, width, height, preview_paths")
    .single();
  if (vidErr || !vid) throw vidErr ?? new Error("failed to insert video");

  assert("videos.width column accepts integer", vid.width === 1920);
  assert("videos.height column accepts integer", vid.height === 1080);
  assert(
    "videos.preview_paths column accepts text[]",
    Array.isArray(vid.preview_paths) && vid.preview_paths.length === 2
  );

  const anon = createClient<Database>(url, publishableKey);
  const { data: anonVid } = await anon
    .from("videos")
    .select("id, width, height, preview_paths")
    .eq("id", vid.id)
    .maybeSingle();
  assert(
    "anonymous viewer reads new video columns",
    anonVid?.width === 1920 &&
      anonVid?.height === 1080 &&
      anonVid?.preview_paths?.length === 2
  );

  const clientA = createClient<Database>(url, publishableKey);
  const { error: signInAErr } = await clientA.auth.signInWithPassword({
    email: emailA,
    password,
  });
  if (signInAErr) throw signInAErr;

  const clientB = createClient<Database>(url, publishableKey);
  const { error: signInBErr } = await clientB.auth.signInWithPassword({
    email: emailB,
    password,
  });
  if (signInBErr) throw signInBErr;

  const { error: anonCommentErr } = await anon.from("comments").insert({
    video_id: vid.id,
    user_id: a.user.id,
    body: "anon attempt",
  });
  assert("anonymous comment insert is rejected", anonCommentErr !== null);

  const { data: ownComment, error: ownCommentErr } = await clientA
    .from("comments")
    .insert({
      video_id: vid.id,
      user_id: a.user.id,
      body: "hello from A",
    })
    .select("id")
    .single();
  assert("auth user can post comment as themselves", ownCommentErr === null);
  if (!ownComment) throw new Error("comment insert returned no row");

  const { error: spoofCommentErr } = await clientA.from("comments").insert({
    video_id: vid.id,
    user_id: b.user.id,
    body: "spoof attempt",
  });
  assert(
    "posting comment as another user is rejected",
    spoofCommentErr !== null
  );

  const { data: emptyCommentRow, error: emptyCommentErr } = await clientA
    .from("comments")
    .insert({
      video_id: vid.id,
      user_id: a.user.id,
      body: "   ",
    })
    .select("id")
    .maybeSingle();
  assert(
    "whitespace-only comment is rejected",
    emptyCommentErr !== null && !emptyCommentRow
  );

  const { data: bCrossEdit } = await clientB
    .from("comments")
    .update({ body: "hacked by B" })
    .eq("id", ownComment.id)
    .select("id");
  assert(
    "cross-user edit affects no rows (RLS blocks)",
    (bCrossEdit?.length ?? 0) === 0
  );

  const { data: ownEdit, error: ownEditErr } = await clientA
    .from("comments")
    .update({ body: "edited by A", edited_at: new Date().toISOString() })
    .eq("id", ownComment.id)
    .select("body")
    .single();
  assert(
    "author can edit own comment",
    ownEditErr === null && ownEdit?.body === "edited by A"
  );

  const { error: voteAErr } = await clientA.from("comment_votes").insert({
    comment_id: ownComment.id,
    user_id: a.user.id,
    value: 1,
  });
  assert("auth user can upvote a comment", voteAErr === null);

  const { error: voteBSpoofErr } = await clientB.from("comment_votes").insert({
    comment_id: ownComment.id,
    user_id: a.user.id,
    value: -1,
  });
  assert("voting as another user is rejected", voteBSpoofErr !== null);

  const { error: voteSwitchErr } = await clientA
    .from("comment_votes")
    .update({ value: -1 })
    .eq("comment_id", ownComment.id)
    .eq("user_id", a.user.id);
  assert("voter can switch their own vote", voteSwitchErr === null);

  const { data: votesAfterSwitch } = await admin
    .from("comment_votes")
    .select("value")
    .eq("comment_id", ownComment.id);
  assert(
    "switching does not insert a second row",
    (votesAfterSwitch?.length ?? 0) === 1 && votesAfterSwitch?.[0]?.value === -1
  );

  const { error: voteRemoveErr } = await clientA
    .from("comment_votes")
    .delete()
    .eq("comment_id", ownComment.id)
    .eq("user_id", a.user.id);
  assert("voter can remove their own vote", voteRemoveErr === null);

  const { data: bCrossDelete } = await clientB
    .from("comments")
    .delete()
    .eq("id", ownComment.id)
    .select("id");
  assert(
    "cross-user delete affects no rows (RLS blocks)",
    (bCrossDelete?.length ?? 0) === 0
  );

  const { error: ownDeleteErr } = await clientA
    .from("comments")
    .delete()
    .eq("id", ownComment.id);
  assert("author can delete own comment", ownDeleteErr === null);

  const { data: anonReadComments } = await anon
    .from("comments")
    .select("id")
    .eq("video_id", vid.id);
  assert(
    "anonymous viewer can read comments table",
    Array.isArray(anonReadComments)
  );

  await admin.from("videos").delete().eq("id", vid.id);
  await admin.auth.admin.deleteUser(a.user.id);
  await admin.auth.admin.deleteUser(b.user.id);
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("VOD UX check failed:", error);
    process.exit(1);
  });

// Proves the visibility rule against the real database, from the readers that
// actually matter: an anonymous visitor, a signed-in stranger, and the owner.
//
// Every row this creates is removed again, including on failure, so running it
// against production leaves nothing behind.
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
  const password = "Password123!";
  const ownerEmail = `vis_owner_${stamp}@test.local`;
  const strangerEmail = `vis_stranger_${stamp}@test.local`;

  const created: {
    videoIds: string[];
    channelId?: string;
    userIds: string[];
  } = { videoIds: [], userIds: [] };

  try {
    const { data: owner } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    const { data: stranger } = await admin.auth.admin.createUser({
      email: strangerEmail,
      password,
      email_confirm: true,
    });
    if (!owner?.user || !stranger?.user) {
      throw new Error("could not create the two test accounts");
    }
    created.userIds.push(owner.user.id, stranger.user.id);

    const { data: channel, error: channelError } = await admin
      .from("channels")
      .insert({
        owner_user_id: owner.user.id,
        slug: `vis-check-${stamp}`,
        handle: `vis_check_${stamp}`,
        name: "Visibility check",
      })
      .select("id")
      .single();
    if (channelError || !channel) {
      throw new Error(`could not create the channel: ${channelError?.message}`);
    }
    created.channelId = channel.id;

    const visibilities = ["public", "unlisted", "private"] as const;
    const ids: Record<string, string> = {};
    for (const visibility of visibilities) {
      const { data: video, error } = await admin
        .from("videos")
        .insert({
          channel_id: channel.id,
          status: "ready",
          visibility,
          title: `${visibility} recording`,
          mp4_path: `vod/vis-check/${stamp}-${visibility}.mp4`,
        })
        .select("id")
        .single();
      if (error || !video) {
        throw new Error(`could not create the ${visibility} recording`);
      }
      ids[visibility] = video.id;
      created.videoIds.push(video.id);
    }

    const anon = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const readAs = async (
      client: ReturnType<typeof createClient<Database>>,
      id: string
    ) => {
      const { data } = await client
        .from("videos")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      return !!data;
    };

    assert(
      "an anonymous visitor can read the public recording",
      await readAs(anon, ids.public)
    );
    assert(
      "an anonymous visitor can read the unlisted recording by its address",
      await readAs(anon, ids.unlisted)
    );
    assert(
      "an anonymous visitor cannot read the private recording",
      !(await readAs(anon, ids.private))
    );

    const strangerClient = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await strangerClient.auth.signInWithPassword({
      email: strangerEmail,
      password,
    });
    assert(
      "a signed-in stranger cannot read the private recording",
      !(await readAs(strangerClient, ids.private))
    );

    const ownerClient = createClient<Database>(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await ownerClient.auth.signInWithPassword({ email: ownerEmail, password });
    assert(
      "the owner can read their own private recording",
      await readAs(ownerClient, ids.private)
    );

    // Not-found rather than forbidden: a withheld recording must not announce
    // itself by the shape of the failure.
    const { data: withheld, error: withheldError } = await anon
      .from("videos")
      .select("id")
      .eq("id", ids.private)
      .maybeSingle();
    assert(
      "a withheld recording reads as absent, not as an error",
      withheld === null && !withheldError
    );

    // The listing is what unlisted is kept out of, and the policy deliberately
    // does not do that job.
    const { data: listed } = await anon
      .from("videos")
      .select("id, visibility")
      .eq("channel_id", channel.id)
      .eq("status", "ready");
    const listedVisibilities = (listed ?? []).map((v) => v.visibility).sort();
    assert(
      "the read policy passes public and unlisted, and withholds private",
      listedVisibilities.join(",") === "public,unlisted"
    );

    await strangerClient.auth.signOut();
    await ownerClient.auth.signOut();
  } finally {
    if (created.videoIds.length) {
      await admin.from("videos").delete().in("id", created.videoIds);
    }
    if (created.channelId) {
      await admin.from("channels").delete().eq("id", created.channelId);
    }
    for (const id of created.userIds) {
      await admin.auth.admin.deleteUser(id);
    }
    console.log("cleaned up");
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

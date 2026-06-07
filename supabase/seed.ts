import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const supabase = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateStreamKey() {
  return `vt_live_${randomBytes(24).toString("hex")}`;
}

async function seed() {
  console.log("Starting database seed...");

  const ownerEmail = process.env.ADMIN_EMAIL;
  const ownerPassword = process.env.ADMIN_PASSWORD;
  if (!ownerEmail || !ownerPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });

  let ownerId: string;
  if (createError) {
    const { data: list, error: listError } =
      await supabase.auth.admin.listUsers();
    if (listError) {
      console.error("Error listing users:", listError);
      process.exit(1);
    }
    const existing = list.users.find((u) => u.email === ownerEmail);
    if (!existing) {
      console.error("Error creating owner user:", createError);
      process.exit(1);
    }
    ownerId = existing.id;
    console.log(`Owner auth user already exists: ${ownerEmail}`);
  } else {
    ownerId = created.user!.id;
    console.log(`Created owner auth user: ${ownerEmail}`);
  }

  const { data: existingChannel, error: channelReadError } = await supabase
    .from("channels")
    .select("id")
    .eq("slug", "owner")
    .maybeSingle();
  if (channelReadError) {
    console.error("Error reading owner channel:", channelReadError);
    process.exit(1);
  }

  let channelId: string;
  if (existingChannel) {
    channelId = existingChannel.id;
    console.log("Owner channel already exists");
  } else {
    const { data: inserted, error: channelError } = await supabase
      .from("channels")
      .insert({
        owner_user_id: ownerId,
        slug: "owner",
        handle: "owner",
        name: "Owner Channel",
        description: "The first channel on vids.tube.",
      })
      .select("id")
      .single();
    if (channelError || !inserted) {
      console.error("Error creating owner channel:", channelError);
      process.exit(1);
    }
    channelId = inserted.id;
    console.log("Created owner channel");
  }

  const { data: existingKey, error: keyReadError } = await supabase
    .from("stream_keys")
    .select("channel_id")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (keyReadError) {
    console.error("Error reading stream key:", keyReadError);
    process.exit(1);
  }
  if (!existingKey) {
    const { error: keyError } = await supabase
      .from("stream_keys")
      .insert({ channel_id: channelId, key: generateStreamKey() });
    if (keyError) {
      console.error("Error creating stream key:", keyError);
      process.exit(1);
    }
    console.log("Created owner stream key");
  } else {
    console.log("Owner stream key already exists");
  }

  const { data: existingStream, error: streamReadError } = await supabase
    .from("streams")
    .select("id")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (streamReadError) {
    console.error("Error reading stream:", streamReadError);
    process.exit(1);
  }
  if (!existingStream) {
    const { error: streamError } = await supabase
      .from("streams")
      .insert({ channel_id: channelId, status: "idle", title: "Owner stream" });
    if (streamError) {
      console.error("Error creating stream:", streamError);
      process.exit(1);
    }
    console.log("Created idle stream");
  } else {
    console.log("Stream already exists");
  }

  console.log("Seed complete!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });

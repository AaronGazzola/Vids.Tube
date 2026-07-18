import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;
let ownerSlug: string;

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  ownerSlug = owner!.slug;
});

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  return (count ?? 0) > 0;
}

test("a VidsBot reply renders with the bot identity in the public chat", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  const stamp = Date.now();

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E bot reply ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  try {
    await admin.from("chat_messages").insert({
      stream_id: live!.id,
      origin: "bot",
      user_id: null,
      author_name: "VidsBot",
      body: `E2E bot hello ${stamp}`,
    });

    await page.goto(`/${ownerSlug}/live`);
    await expect(page.getByText(`E2E bot hello ${stamp}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("VidsBot", { exact: true })).toBeVisible();
    await expect(page.getByText("BOT", { exact: true })).toBeVisible();
  } finally {
    await admin.from("chat_messages").delete().eq("stream_id", live!.id);
    await admin.from("streams").delete().eq("id", live!.id);
  }
});

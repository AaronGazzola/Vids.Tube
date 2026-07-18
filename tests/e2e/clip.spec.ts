import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

test("the clip shortlist shows post-stream markers in the Activity tab", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();

  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const ownerChannelId = owner!.id;

  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  test.skip((count ?? 0) > 0, "an active broadcast row exists");

  const base = stamp - 3_600_000;
  const { data: ended } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "ended",
      title: `E2E clip shortlist ${stamp}`,
      started_at: new Date(base).toISOString(),
      live_at: new Date(base + 60_000).toISOString(),
      ended_at: new Date(stamp).toISOString(),
    })
    .select("id")
    .single();

  await admin.from("clip_markers").insert({
    channel_id: ownerChannelId,
    stream_id: ended!.id,
    participant_key: "youtube:UC_CLIP_E2E",
    origin: "youtube",
    author_name: "ClipFan",
    stream_time_s: 754,
    snippet: `E2E clip snippet ${stamp}`,
  });

  try {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    await page.goto("/live");
    await page.getByRole("tab", { name: "Activity" }).click();
    await page.getByRole("button", { name: /Clip markers/ }).click();
    await expect(page.getByText("12:34", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("ClipFan")).toBeVisible();
    await expect(page.getByText(`E2E clip snippet ${stamp}`)).toBeVisible();
  } finally {
    await admin.from("clip_markers").delete().eq("stream_id", ended!.id);
    await admin.from("streams").delete().eq("id", ended!.id);
  }
});

test("a live clip request is styled inline in the Activity chat", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();

  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const ownerChannelId = owner!.id;

  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  test.skip((count ?? 0) > 0, "an active broadcast row exists");

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E clip live ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  const { data: chatMsg } = await admin
    .from("chat_messages")
    .insert({
      stream_id: live!.id,
      origin: "youtube",
      external_author_id: "UC_CLIP_E2E",
      author_name: "ClipFan",
      body: `!clip E2E live clip ${stamp}`,
    })
    .select("id")
    .single();
  await admin.from("clip_markers").insert({
    channel_id: ownerChannelId,
    stream_id: live!.id,
    chat_message_id: chatMsg!.id,
    participant_key: "youtube:UC_CLIP_E2E",
    origin: "youtube",
    author_name: "ClipFan",
    stream_time_s: 754,
    snippet: `E2E live clip ${stamp}`,
  });

  try {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    await page.goto("/live");
    await page.getByRole("tab", { name: "Activity" }).click();
    const row = page
      .locator("li", { hasText: `!clip E2E live clip ${stamp}` })
      .first();
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.locator("code")).toHaveText("12:34");
  } finally {
    await admin.from("clip_markers").delete().eq("stream_id", live!.id);
    await admin.from("chat_messages").delete().eq("stream_id", live!.id);
    await admin.from("streams").delete().eq("id", live!.id);
  }
});

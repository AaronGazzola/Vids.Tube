import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Three recordings on a throwaway channel, one of each visibility, so the
// assertion is about the rule rather than about whatever the owner's real
// catalogue happens to hold. Everything is removed again afterwards.
const stamp = Date.now();
const slug = `vis-e2e-${stamp}`;
let channelId: string;
const videoIds: string[] = [];
let unlistedId: string;
let privateId: string;

test.beforeAll(async () => {
  const { data: channel, error } = await admin
    .from("channels")
    .insert({
      slug,
      handle: `vis_e2e_${stamp}`,
      name: `Visibility ${stamp}`,
    })
    .select("id")
    .single();
  if (error || !channel) throw error ?? new Error("channel not created");
  channelId = channel.id;

  for (const visibility of ["public", "unlisted", "private"] as const) {
    const { data: video, error: videoError } = await admin
      .from("videos")
      .insert({
        channel_id: channelId,
        status: "ready",
        visibility,
        title: `${visibility} recording ${stamp}`,
        mp4_path: `vod/vis-e2e/${stamp}-${visibility}.mp4`,
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (videoError || !video) throw videoError ?? new Error("video not created");
    videoIds.push(video.id);
    if (visibility === "unlisted") unlistedId = video.id;
    if (visibility === "private") privateId = video.id;
  }
});

test.afterAll(async () => {
  if (videoIds.length) await admin.from("videos").delete().in("id", videoIds);
  if (channelId) await admin.from("channels").delete().eq("id", channelId);
});

test("the channel lists the public recording only", async ({ page }) => {
  await page.goto(`/${slug}`);

  await expect(
    page.getByText(`public recording ${stamp}`)
  ).toBeVisible();
  await expect(page.getByText(`unlisted recording ${stamp}`)).toHaveCount(0);
  await expect(page.getByText(`private recording ${stamp}`)).toHaveCount(0);
});

test("an unlisted recording still plays from its own address", async ({
  page,
}) => {
  await page.goto(`/watch/${unlistedId}`);

  await expect(page.getByText(`unlisted recording ${stamp}`)).toBeVisible();
});

test("a private recording is not found by a visitor", async ({ page }) => {
  await page.goto(`/watch/${privateId}`);

  await expect(page.getByText(`private recording ${stamp}`)).toHaveCount(0);
});

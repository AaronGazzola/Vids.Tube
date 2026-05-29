import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stamp = Date.now();
const withVodsSlug = `e2e-vods-${stamp}`;
const emptySlug = `e2e-empty-${stamp}`;

let withVodsChannelId: string;
let emptyChannelId: string;
let newerVideoId: string;

test.beforeAll(async () => {
  const { data: owner, error: ownerErr } = await admin
    .from("channels")
    .select("owner_user_id")
    .eq("slug", "owner")
    .single();
  if (ownerErr || !owner) throw ownerErr ?? new Error("owner channel missing");
  const ownerUserId = owner.owner_user_id;

  const { data: withVods } = await admin
    .from("channels")
    .insert({
      owner_user_id: ownerUserId,
      slug: withVodsSlug,
      name: "E2E VOD Channel",
    })
    .select("id")
    .single();
  withVodsChannelId = withVods!.id;

  const { data: empty } = await admin
    .from("channels")
    .insert({
      owner_user_id: ownerUserId,
      slug: emptySlug,
      name: "E2E Empty Channel",
    })
    .select("id")
    .single();
  emptyChannelId = empty!.id;

  await admin.from("videos").insert({
    channel_id: withVodsChannelId,
    status: "ready",
    title: "E2E Older VOD",
    mp4_path: `vod/${withVodsSlug}/older.mp4`,
    published_at: new Date(stamp - 86_400_000).toISOString(),
  });

  const { data: newer } = await admin
    .from("videos")
    .insert({
      channel_id: withVodsChannelId,
      status: "ready",
      title: "E2E Newer VOD",
      mp4_path: `vod/${withVodsSlug}/newer.mp4`,
      published_at: new Date(stamp).toISOString(),
    })
    .select("id")
    .single();
  newerVideoId = newer!.id;
});

test.afterAll(async () => {
  await admin.from("channels").delete().eq("id", withVodsChannelId);
  await admin.from("channels").delete().eq("id", emptyChannelId);
});

test("channel page lists ready VODs newest-first", async ({ page }) => {
  await page.goto(`/${withVodsSlug}`);

  await expect(page.getByRole("link", { name: /E2E Newer VOD/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /E2E Older VOD/ })).toBeVisible();

  await expect(page.locator("a[href^='/watch/']").first()).toHaveAttribute(
    "href",
    `/watch/${newerVideoId}`
  );
});

test("channel page with no VODs shows the empty state", async ({ page }) => {
  await page.goto(`/${emptySlug}`);
  await expect(page.getByText("No videos yet.")).toBeVisible();
});

test("watch page renders the player for a ready video", async ({ page }) => {
  await page.goto(`/watch/${newerVideoId}`);
  await expect(
    page.getByRole("heading", { name: "E2E Newer VOD" })
  ).toBeVisible();
  await expect(page.locator("video")).toBeVisible();
});

test("watch page shows unavailable for a non-ready id", async ({ page }) => {
  await page.goto("/watch/00000000-0000-0000-0000-000000000000");
  await expect(
    page.getByRole("heading", { name: "Video not available" })
  ).toBeVisible();
});

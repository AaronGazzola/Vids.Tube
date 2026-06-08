import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stamp = Date.now();

let ownerChannelId: string;
let ownerSlug: string;
let olderVideoId: string;
let newerVideoId: string;

test.beforeAll(async () => {
  const { data: owner, error: ownerErr } = await admin
    .from("channels")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ownerErr || !owner) throw ownerErr ?? new Error("owner channel missing");
  ownerChannelId = owner.id;
  ownerSlug = owner.slug;

  const { data: older } = await admin
    .from("videos")
    .insert({
      channel_id: ownerChannelId,
      status: "ready",
      title: "E2E Older VOD",
      mp4_path: `vod/e2e-${stamp}/older.mp4`,
      published_at: new Date(stamp - 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  olderVideoId = older!.id;

  const { data: newer } = await admin
    .from("videos")
    .insert({
      channel_id: ownerChannelId,
      status: "ready",
      title: "E2E Newer VOD",
      mp4_path: `vod/e2e-${stamp}/newer.mp4`,
      published_at: new Date(stamp).toISOString(),
    })
    .select("id")
    .single();
  newerVideoId = newer!.id;
});

test.afterAll(async () => {
  await admin.from("videos").delete().eq("id", olderVideoId);
  await admin.from("videos").delete().eq("id", newerVideoId);
});

// Owner-gated rework (AZ-48): channel viewing is now restricted to the platform
// owner's channel, so these assert against the seeded owner channel (which always
// has VODs) rather than a throwaway channel. The old "channel with no VODs shows
// the empty state" case is unreachable under owner-gating — the only viewable
// channel is the owner's, which has VODs — so it is removed rather than reworked.
test("the owner channel lists ready VODs newest-first", async ({ page }) => {
  await page.goto(`/${ownerSlug}`);
  const newer = page.getByText("E2E Newer VOD", { exact: true });
  const older = page.getByText("E2E Older VOD", { exact: true });
  await expect(newer).toBeVisible();
  await expect(older).toBeVisible();
  const newerBox = await newer.boundingBox();
  const olderBox = await older.boundingBox();
  expect(newerBox!.y).toBeLessThan(olderBox!.y);
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

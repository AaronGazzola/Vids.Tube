import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stamp = Date.now();
const HEADING = "Link your YouTube history";
const CODE = /^[A-Z2-9]{6}$/;

let ownerChannelId: string;
let ownerSlug: string;
let ownerUserId: string;
let hasActiveRow = false;
let waitingRoomId: string | null = null;
let savedLink: Database["public"]["Tables"]["youtube_links"]["Row"] | null =
  null;

async function clearLink() {
  await admin.from("youtube_links").delete().eq("user_id", ownerUserId);
}

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  ownerSlug = owner!.slug;
  ownerUserId = owner!.owner_user_id!;

  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  hasActiveRow = (count ?? 0) > 0;
  if (hasActiveRow) return;

  const { data: existing } = await admin
    .from("youtube_links")
    .select("*")
    .eq("user_id", ownerUserId)
    .maybeSingle();
  savedLink = existing ?? null;
  await clearLink();

  const { data: scheduled, error } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "scheduled",
      scheduled_start_at: new Date(stamp + 1_800_000).toISOString(),
      waiting_room_chat: true,
      title: `E2E verify banner ${stamp}`,
    })
    .select("id")
    .single();
  if (error) throw error;
  waitingRoomId = scheduled!.id;
});

test.afterAll(async () => {
  if (waitingRoomId) {
    await admin.from("streams").delete().eq("id", waitingRoomId);
  }
  if (hasActiveRow) return;
  await clearLink();
  if (savedLink) {
    await admin.from("youtube_links").insert(savedLink);
  }
});

test("a visitor who is not signed in never sees the banner", async ({
  page,
}) => {
  test.skip(hasActiveRow, "an active broadcast row exists");

  await page.goto(`/${ownerSlug}/live`);
  await expect(page.getByText("Live chat", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(HEADING)).toHaveCount(0);
});

test("an unverified viewer gets a code, and collapsing puts it away", async ({
  page,
}) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(120_000);

  await clearLink();
  await loginAsOwner(page);
  await page.goto(`/${ownerSlug}/live`);

  await expect(page.getByText(HEADING)).toBeVisible({ timeout: 20_000 });
  const code = page.locator("code", { hasText: CODE });
  await expect(code).toBeVisible();

  await page.getByRole("button", { name: "Collapse" }).click();
  await expect(code).toHaveCount(0);
  await expect(page.getByRole("button", { name: HEADING })).toBeVisible();

  await page.getByRole("button", { name: HEADING }).click();
  await expect(page.locator("code", { hasText: CODE })).toBeVisible();
});

test("the banner is gone once the viewer is verified", async ({ page }) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(120_000);

  await clearLink();
  const { error } = await admin.from("youtube_links").insert({
    user_id: ownerUserId,
    verify_code: "ZZ9ZZ9",
    youtube_handle: "e2everified",
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  await loginAsOwner(page);
  await page.goto(`/${ownerSlug}/live`);

  await expect(page.getByText("Live chat", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(HEADING)).toHaveCount(0);
});

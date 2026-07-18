import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;
const stamp = Date.now();

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
});

test.afterAll(async () => {
  await admin
    .from("channel_projects")
    .delete()
    .eq("channel_id", ownerChannelId)
    .like("name", "E2E Project%");
});

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  return (count ?? 0) > 0;
}

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

test("the bot moments switches and projects manager round-trip", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  await loginAsOwner(page);
  await page.goto("/live");
  await expect(page.getByText("Bot moments", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Useful info", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Competition status", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Progress update", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("MVP announcement", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "Add project" }).click();
  await page.fill("#proj-name", `E2E Project ${stamp}`);
  await page.fill("#proj-blurb", "an e2e project");
  await page.fill("#proj-domain", "https://example.com");
  await page.getByRole("button", { name: "Add project" }).last().click();
  await expect(page.getByText(`E2E Project ${stamp}`)).toBeVisible({
    timeout: 15_000,
  });

  await page
    .locator("li", { hasText: `E2E Project ${stamp}` })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByText(`E2E Project ${stamp}`)).toHaveCount(0, {
    timeout: 15_000,
  });
});

test("the wrap up button stamps the request", async ({ page }) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E wrapup ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  try {
    await loginAsOwner(page);
    await page.goto("/live");
    await page.getByRole("tab", { name: "Activity" }).click();
    await page.getByRole("button", { name: "Wrap up" }).click();
    await expect(page.getByText("Send the wrap-up messages?")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Wrap up" })
      .click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("streams")
            .select("wrapup_requested_at")
            .eq("id", live!.id)
            .single();
          return !!data?.wrapup_requested_at;
        },
        { timeout: 15_000 }
      )
      .toBe(true);
  } finally {
    await admin.from("streams").delete().eq("id", live!.id);
  }
});

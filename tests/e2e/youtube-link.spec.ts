import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerUserId: string;

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerUserId = owner!.owner_user_id;
  await admin.from("youtube_links").delete().eq("user_id", ownerUserId);
});

test.afterAll(async () => {
  await admin.from("youtube_links").delete().eq("user_id", ownerUserId);
});

test("linking a handle resolves it and shows the verify code, then unlinks", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");

  await page.goto("/account");
  await expect(page.getByText("YouTube account")).toBeVisible({
    timeout: 20_000,
  });

  await page.getByPlaceholder("@yourhandle").fill("@YouTube");
  await page.getByRole("button", { name: "Link", exact: true }).click();

  await expect(page.getByText("Linked to @youtube")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Unverified")).toBeVisible();
  await expect(page.locator("code", { hasText: /^[A-Z2-9]{6}$/ })).toBeVisible();

  await page.getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByPlaceholder("@yourhandle")).toBeVisible({
    timeout: 20_000,
  });
});

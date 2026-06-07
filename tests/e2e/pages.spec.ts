import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerSlug: string;
let ownerName: string;

test.beforeAll(async () => {
  const { data, error } = await admin
    .from("channels")
    .select("slug, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("owner channel missing");
  ownerSlug = data.slug;
  ownerName = data.name;
});

test("home renders the owner channel experience", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "vids.tube" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: ownerName })
  ).toBeVisible();
});

test("live path redirects to the owner channel page", async ({ page }) => {
  await page.goto("/live");
  await expect(page).toHaveURL(new RegExp(`/${ownerSlug}$`));
  await expect(page.getByText("Live chat")).toHaveCount(0);
});

test("account redirects anonymous users to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("studio redirects non-owners to home", async ({ page }) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/");
});

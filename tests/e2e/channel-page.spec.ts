import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerSlug: string;
let ownerName: string;
let ownerHandle: string;

test.beforeAll(async () => {
  const { data, error } = await admin
    .from("channels")
    .select("slug, name, handle")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("owner channel missing");
  ownerSlug = data.slug;
  ownerName = data.name;
  ownerHandle = data.handle;
});

test("owner channel renders its name and handle", async ({ page }) => {
  await page.goto(`/${ownerSlug}`);

  await expect(
    page.getByRole("heading", { name: ownerName })
  ).toBeVisible();
  await expect(page.getByText(`@${ownerHandle}`)).toBeVisible();
});

test("unknown channel shows the not-found state", async ({ page }) => {
  await page.goto("/this-channel-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "Channel not found" })
  ).toBeVisible();
});

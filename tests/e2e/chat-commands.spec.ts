import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerSlug: string;

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerSlug = owner!.slug;
});

test("the public command guide lists the enabled commands signed out", async ({
  page,
}) => {
  await page.goto(`/${ownerSlug}/commands`);
  await expect(
    page.getByRole("heading", { name: "Chat commands" })
  ).toBeVisible();
  await expect(page.getByText("!help", { exact: true })).toBeVisible();
  await expect(
    page.getByText("List the available chat commands")
  ).toBeVisible();
});

test("an unknown channel slug shows the not-found state", async ({ page }) => {
  await page.goto("/this-channel-does-not-exist/commands");
  await expect(page.getByText("Channel not found.")).toBeVisible();
});

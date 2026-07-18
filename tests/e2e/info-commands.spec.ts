import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;
let ownerSlug: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  ownerSlug = owner!.slug;
  await admin
    .from("chat_commands")
    .delete()
    .eq("channel_id", ownerChannelId)
    .eq("keyword", "e2ecmd");
});

test.afterAll(async () => {
  await admin
    .from("chat_commands")
    .delete()
    .eq("channel_id", ownerChannelId)
    .eq("keyword", "e2ecmd");
  await admin
    .from("streams")
    .delete()
    .eq("channel_id", ownerChannelId)
    .like("title", "E2E info commands ui%");
});

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  return (count ?? 0) > 0;
}

test("the settings command manager lists, adds, excludes, and deletes", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");

  await page.goto("/live");
  await expect(page.getByText("Chat commands", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  const helpRow = page.locator("li", { hasText: "!help" });
  await expect(helpRow).toBeVisible({ timeout: 15_000 });
  await expect(helpRow.getByRole("button", { name: "Edit" })).toHaveCount(0);

  await page.getByRole("button", { name: "Add command" }).click();
  await page.fill("#cmd-keyword", "e2ecmd");
  await page.fill("#cmd-description", "E2E test command");
  await page.fill("#cmd-response", "This is the e2e response");
  await page
    .getByRole("button", { name: "Add command" })
    .last()
    .click();
  const customRow = page.locator("li", { hasText: "!e2ecmd" });
  await expect(customRow).toBeVisible({ timeout: 15_000 });
  await expect(customRow.getByRole("button", { name: "Edit" })).toBeVisible();

  await page.goto(`/${ownerSlug}/commands`);
  await expect(page.getByText("!e2ecmd")).toBeVisible({ timeout: 15_000 });

  await page.goto("/live");
  await page.fill("#title", "E2E info commands ui");
  const e2eCheckbox = page
    .locator("li", { hasText: "!e2ecmd" })
    .locator('input[type="checkbox"]');
  await e2eCheckbox.uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("streams")
          .select("disabled_commands")
          .eq("channel_id", ownerChannelId)
          .in("status", ["draft", "scheduled"])
          .maybeSingle();
        return data?.disabled_commands ?? null;
      },
      { timeout: 20_000 }
    )
    .toEqual(["e2ecmd"]);

  await page
    .locator("li", { hasText: "!e2ecmd" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.locator("li", { hasText: "!e2ecmd" })).toHaveCount(0, {
    timeout: 15_000,
  });
});

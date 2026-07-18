import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;
let savedLayout: Json | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  const { data: layout } = await admin
    .from("demo_layouts")
    .select("config")
    .eq("channel_id", ownerChannelId)
    .maybeSingle();
  savedLayout = layout?.config ?? null;
});

test.afterAll(async () => {
  if (savedLayout) {
    await admin.from("demo_layouts").upsert(
      {
        channel_id: ownerChannelId,
        config: savedLayout,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" }
    );
  } else {
    await admin
      .from("demo_layouts")
      .delete()
      .eq("channel_id", ownerChannelId);
  }
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

async function enableDemo(page: Page) {
  await page.goto("/live");
  const demoSwitch = page
    .locator('div:has(> span:text-is("Demo"))')
    .locator('button[role="switch"]');
  await demoSwitch.click();
}

test("demo interactivity: panels, overlay parity, wrap-up", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(240_000);

  await loginAsOwner(page);
  await enableDemo(page);
  const stage = page.getByTestId("demo-stage");

  await page.getByRole("tab", { name: "Activity" }).click();
  const ttsPanel = page.locator("div.rounded-lg.border", {
    hasText: "TTS requests",
  });
  await expect(
    ttsPanel
      .getByText("big shoutout to the mods, you keep this place cozy")
      .first()
  ).toBeVisible({ timeout: 15_000 });

  await ttsPanel
    .locator("li", { hasText: "big shoutout" })
    .first()
    .getByRole("button", { name: "Approve" })
    .click();

  await page.getByRole("tab", { name: "Preview" }).click();
  const stageTts = stage.getByText(
    "big shoutout to the mods, you keep this place cozy"
  );
  await expect(stageTts).toBeVisible({ timeout: 10_000 });
  await expect(stageTts).toHaveCount(0, { timeout: 25_000 });

  await page.getByRole("tab", { name: "Activity" }).click();
  const askPanel = page.locator("div.rounded-lg.border", {
    hasText: "Ask requests",
  });
  const ask1 = askPanel
    .locator("li", { hasText: "what editor theme is that?" })
    .first();
  await expect(ask1).toBeVisible({ timeout: 10_000 });
  await ask1.getByRole("button", { name: "Approve" }).click();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(stage.getByText("what editor theme is that?")).toBeVisible({
    timeout: 10_000,
  });
  await expect(stage.getByText("Fira Code font", { exact: false })).toBeVisible(
    { timeout: 5_000 }
  );
  await expect(stage.getByText("what editor theme is that?")).toHaveCount(0, {
    timeout: 20_000,
  });

  await page.getByRole("tab", { name: "Activity" }).click();
  const ask2 = askPanel
    .locator("li", { hasText: "how long have you been building" })
    .first();
  await ask2.locator('button[role="checkbox"]').click();
  await ask2.getByRole("button", { name: "Approve" }).click();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(
    stage.getByText("how long have you been building vids.tube?")
  ).toBeVisible({ timeout: 10_000 });
  await expect(stage.getByText("weekend project")).toHaveCount(0);

  const askSwitchRow = page.locator("label", { hasText: "!ask exchange" });
  await askSwitchRow.locator('button[role="switch"]').click();
  await expect(
    stage.getByText("how long have you been building vids.tube?")
  ).toHaveCount(0, { timeout: 5_000 });
  await expect(
    page
      .locator("label", { hasText: "TTS card" })
      .locator('button[role="switch"]')
  ).toBeVisible();

  await page.getByRole("tab", { name: "Activity" }).click();
  const clipPanel = page.locator("div.rounded-lg.border", {
    hasText: "Clip markers",
  });
  await expect(clipPanel.getByText("that overlay reveal").first()).toBeVisible();

  await page.getByRole("button", { name: "Wrap up", exact: true }).click();
  await expect(page.getByText("Send the wrap-up messages?")).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Wrap up" })
    .click();
  await expect(page.getByText("MVP of the stream:").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Thanks for watching!").first()).toBeVisible();
  expect(
    await page.getByText("BOT", { exact: true }).count()
  ).toBeGreaterThan(2);
  await expect(
    page.getByRole("button", { name: "Wrap-up sent" })
  ).toBeDisabled();
});

test("new overlay toggles persist with the demo layout", async ({ page }) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  await admin.from("demo_layouts").upsert(
    {
      channel_id: ownerChannelId,
      config: { visible: { highlight: false } },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel_id" }
  );

  await loginAsOwner(page);
  await enableDemo(page);

  const highlightSwitch = page
    .locator("label", { hasText: /^Highlight$/ })
    .locator('button[role="switch"]');
  await expect(highlightSwitch).toHaveAttribute("data-state", "unchecked", {
    timeout: 20_000,
  });

  await page
    .locator("label", { hasText: "TTS card" })
    .locator('button[role="switch"]')
    .click();

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("demo_layouts")
          .select("config")
          .eq("channel_id", ownerChannelId)
          .maybeSingle();
        const config = data?.config as {
          visible?: Record<string, boolean>;
        } | null;
        return config?.visible?.tts ?? null;
      },
      { message: "tts toggle persists to demo_layouts", timeout: 15_000 }
    )
    .toBe(false);
});

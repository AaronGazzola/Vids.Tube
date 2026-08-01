import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let labelledStreamId: string | null = null;

test.beforeAll(async () => {
  const { data, error } = await admin
    .from("stream_sections")
    .select("stream_id")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  labelledStreamId = data?.stream_id ?? null;
});

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

test("anonymous visitors are redirected away from the studio", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page).toHaveURL("/", { timeout: 20_000 });
});

test("the owner sees the studio nav entry and a vertical list of stream rows", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInAsOwner(page);

  await expect(page.getByRole("link", { name: "Studio" })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Streams" })).toBeVisible({
    timeout: 20_000,
  });

  const rows = page.locator("li", { has: page.getByRole("link", { name: "Timeline" }) });
  await expect(rows.first()).toBeVisible({ timeout: 20_000 });

  const first = rows.first();
  const second = rows.nth(1);
  if (await second.count()) {
    const a = await first.boundingBox();
    const b = await second.boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
  }
});

test("the timeline action opens that stream's timeline", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAsOwner(page);

  await page.goto("/studio");
  await page
    .getByRole("link", { name: "Timeline" })
    .first()
    .click();

  await expect(page).toHaveURL(/\/studio\/timeline\/[0-9a-f-]{36}$/, {
    timeout: 20_000,
  });
  await expect(page.getByRole("link", { name: "Streams" })).toBeVisible();
});

test("a labelled stream renders overlapping lanes with scores", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(!labelledStreamId, "no labelled stream in the database yet");
  await signInAsOwner(page);

  await page.goto(`/studio/timeline/${labelledStreamId}`);

  await expect(page.getByText(/sections ·/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^interest \d+$/).first()).toBeVisible({
    timeout: 20_000,
  });

  const bars = page.locator("button[style*='left:']");
  await expect(bars.first()).toBeVisible();
});

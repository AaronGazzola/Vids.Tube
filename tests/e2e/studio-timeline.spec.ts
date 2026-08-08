import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let labelledStreamId: string | null = null;
let recurringThreadId: string | null = null;

test.beforeAll(async () => {
  // A stream whose labelling produced a subject that comes back later, so the
  // recurring-lane assertion has something real to stand on.
  const { data: spans, error } = await admin
    .from("stream_thread_spans")
    .select("thread_id, stream_id");
  if (error) {
    throw error;
  }
  const counts = new Map<string, { stream: string; spans: number }>();
  for (const span of spans ?? []) {
    const held = counts.get(span.thread_id) ?? {
      stream: span.stream_id,
      spans: 0,
    };
    held.spans += 1;
    counts.set(span.thread_id, held);
  }
  const recurring = [...counts.entries()].find(([, held]) => held.spans > 1);
  if (!recurring) {
    return;
  }
  labelledStreamId = recurring[1].stream;
  recurringThreadId = recurring[0];
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

test("a recurring subject occupies one lane across the stream", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(!labelledStreamId, "no labelled stream in the database yet");
  await signInAsOwner(page);

  await page.goto(`/studio/timeline/${labelledStreamId}`);
  await expect(page.getByText(/threads ·/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/^interest \d+$/).first()).toBeVisible({
    timeout: 20_000,
  });

  // Every appearance of one subject sits at the same height on the map, so the
  // subject reads as one row rather than as unrelated bars.
  const bars = page.locator(`button[data-thread-id="${recurringThreadId}"]`);
  await expect(bars.first()).toBeVisible();
  const count = await bars.count();
  expect(count).toBeGreaterThan(1);

  const tops = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const box = await bars.nth(i).boundingBox();
    tops.add(Math.round(box!.y));
  }
  expect(tops.size).toBe(1);
});

test("moments are drawn at their duration, not as points", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!labelledStreamId, "no labelled stream in the database yet");
  await signInAsOwner(page);

  await page.goto(`/studio/timeline/${labelledStreamId}`);
  await expect(page.getByText(/threads ·/)).toBeVisible({ timeout: 30_000 });

  const moments = page.locator("button.bg-amber-500");
  await expect(moments.first()).toBeVisible({ timeout: 20_000 });
  const box = await moments.first().boundingBox();
  expect(box!.width).toBeGreaterThan(2);
});

test("the stream page carries no per-tag controls", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!labelledStreamId, "no labelled stream in the database yet");
  await signInAsOwner(page);

  await page.goto(`/studio/timeline/${labelledStreamId}`);
  await expect(page.getByText(/threads ·/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "all tags" })).toHaveCount(0);
});

test("selecting a thread plays it fused, and leaving returns to the stream", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(!labelledStreamId, "no labelled stream in the database yet");
  await signInAsOwner(page);

  await page.goto(`/studio/timeline/${labelledStreamId}`);
  await expect(page.getByText(/threads ·/)).toBeVisible({ timeout: 30_000 });

  await page
    .locator(`button[data-thread-id="${recurringThreadId}"]`)
    .first()
    .click();
  await expect(page.getByText(/^Playing/)).toBeVisible();
  await expect(page.getByText(/spans fused, gaps cut/)).toBeVisible();

  await page.getByRole("button", { name: "Whole stream" }).click();
  await expect(page.getByText(/^Playing/)).toHaveCount(0);
});

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

// Everything here stops short of Save changes, on purpose. The point of the
// change is that nothing is written until save, so the whole feature can be
// exercised without touching the owner's real broadcast — which spans three
// tables and would be awkward to put back. The save path itself is covered by
// the unit tests over the reuse mapping and the payload.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;

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

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

async function openSettings(page: Page) {
  await page.goto("/live");
  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByLabel("Title")).toBeVisible({ timeout: 20_000 });
}

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .eq("status", "live");
  return (count ?? 0) > 0;
}

test("choosing a thumbnail keeps unsaved edits and writes nothing", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  await openSettings(page);

  const { data: before } = await admin
    .from("streams")
    .select("thumbnail_path")
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const title = page.getByLabel("Title");
  const original = await title.inputValue();
  await title.fill("an edit that must survive");

  // A 1x1 PNG is enough: what is being tested is that choosing stages rather
  // than uploads, not what the image looks like.
  await page.setInputFiles('input#thumbnail', {
    name: "thumb.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    ),
  });

  await expect(page.getByText("It is stored when you save changes.")).toBeVisible();
  await expect(title).toHaveValue("an edit that must survive");

  const { data: after } = await admin
    .from("streams")
    .select("thumbnail_path")
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(after?.thumbnail_path ?? null).toBe(before?.thumbnail_path ?? null);

  // Reloading discards the staged choice, which is what makes it free.
  await openSettings(page);
  await expect(page.getByLabel("Title")).toHaveValue(original);
});

test("an oversized file is refused at the moment it is chosen", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  await openSettings(page);

  await page.setInputFiles("input#thumbnail", {
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });

  await expect(
    page.getByText("File too large — thumbnail must be 5 MB or smaller.")
  ).toBeVisible();
});

test("the reuse dialog lists ended broadcasts and fills the form", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(await ownerIsLive(), "the control is disabled while live");
  await loginAsOwner(page);
  await openSettings(page);

  const { data: ended } = await admin
    .from("streams")
    .select("id, title")
    .eq("channel_id", ownerChannelId)
    .eq("status", "ended")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  test.skip(!ended, "no ended broadcast to reuse");

  const youtubeBefore = await page
    .getByLabel("YouTube stream URL or video id")
    .inputValue();

  await page.getByRole("button", { name: "Reuse stream settings" }).click();
  await expect(
    page.getByText(/Copies everything from a previous broadcast/)
  ).toBeVisible();

  const rows = page.getByRole("dialog").locator("li");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  await rows.first().locator("button").click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });

  // Title came from the chosen broadcast; the URL is deliberately untouched.
  await expect(page.getByLabel("Title")).toHaveValue(ended!.title ?? "");
  await expect(
    page.getByLabel("YouTube stream URL or video id")
  ).toHaveValue(youtubeBefore);

  // And still nothing has been written.
  await openSettings(page);
  await expect(page.getByLabel("Title")).not.toHaveValue(
    "an edit that must survive"
  );
});

test("the banner is the field, and a metric can be added to a message", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  await openSettings(page);

  // The editable surface is inside the banner's own backing, and there is no
  // second copy of the message to compare against.
  const banner = page.locator(".overlay-surface").first();
  await expect(banner).toBeVisible({ timeout: 20_000 });
  const field = banner.getByRole("textbox", { name: "Message 1" });
  await expect(field).toBeVisible();

  const before = await field.textContent();
  await field.click();
  await page.keyboard.type("!");
  await expect(field).not.toHaveText(before ?? "");

  // The metric controls sit outside the banner, because a number pulled live is
  // not something to type over.
  const include = page.getByRole("checkbox", {
    name: "Show a metric on message 1",
  });
  await expect(include).toBeChecked();
  await page.getByRole("combobox", { name: "Metric for message 1" }).selectOption("chattersThisStream");
  await page.getByRole("combobox", { name: "Icon for message 1" }).selectOption("flame");
  // Off air the figure is unavailable, so the block shows its icon and a dash
  // rather than disappearing and moving the layout.
  const metric = banner.getByTestId("message-banner-metric");
  await expect(metric).toBeVisible();
  await expect(metric).toContainText("—");

  await include.uncheck();
  await expect(banner.getByTestId("message-banner-metric")).toHaveCount(0);

  // Nothing was saved: reloading brings the original message back.
  await openSettings(page);
  await expect(
    page.locator(".overlay-surface").first().getByRole("textbox", { name: "Message 1" })
  ).toHaveText(before ?? "");
});

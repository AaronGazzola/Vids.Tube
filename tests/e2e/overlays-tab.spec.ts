import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../supabase/types";

// Containers being present in the DOM is not evidence that they can be grabbed,
// and a scale value in a store is not evidence that the overlay kept its shape.
// The switch is judged by whether a drag actually moves anything, and the
// resize by the rendered geometry before and after.
//
// The owner's saved layout is put back afterwards, which is the pattern the
// member-messages and demo-interactivity specs use: positions live only in that
// row, and a test must never cost the owner their layout.

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
    .from("overlay_layouts")
    .select("config")
    .eq("channel_id", ownerChannelId)
    .maybeSingle();
  savedLayout = layout?.config ?? null;
});

test.afterAll(async () => {
  if (savedLayout) {
    await admin.from("overlay_layouts").upsert(
      {
        channel_id: ownerChannelId,
        config: savedLayout,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" }
    );
  }
});

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

async function openOverlays(page: Page) {
  await page.goto("/live");
  await page.getByRole("tab", { name: "Overlays" }).click();
  await expect(page.getByTestId("overlays-stage")).toBeVisible({
    timeout: 20_000,
  });
}

// The members strip is always visible by default and has a stable box, so it is
// the one used for geometry.
const BOX = "members";

async function boxRect(page: Page) {
  return page.evaluate((boxKey) => {
    const el = document.querySelector(
      `[data-testid="overlay-container-${boxKey}"]`
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, BOX);
}

test("the tab opens with the panel shown and nothing resizable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAsOwner(page);
  await openOverlays(page);

  await expect(
    page.getByRole("switch", { name: "Show resize and reposition containers" })
  ).toBeVisible();

  await expect(
    page.getByTestId(`overlay-container-${BOX}`)
  ).toHaveCount(0);
  await expect(page.getByTestId(`overlay-handle-${BOX}-br`)).toHaveCount(0);
});

test("turning the switch on reveals four corner handles on a visible overlay", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAsOwner(page);
  await openOverlays(page);

  await page
    .getByRole("switch", { name: "Show resize and reposition containers" })
    .click();

  await expect(page.getByTestId(`overlay-container-${BOX}`)).toBeVisible({
    timeout: 10_000,
  });
  for (const corner of ["tl", "tr", "bl", "br"]) {
    await expect(
      page.getByTestId(`overlay-handle-${BOX}-${corner}`)
    ).toBeVisible();
  }
});

test("dragging a corner resizes without changing the aspect ratio", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  await openOverlays(page);
  await page
    .getByRole("switch", { name: "Show resize and reposition containers" })
    .click();
  await expect(page.getByTestId(`overlay-container-${BOX}`)).toBeVisible({
    timeout: 10_000,
  });

  const before = await boxRect(page);
  expect(before).not.toBeNull();

  const handle = page.getByTestId(`overlay-handle-${BOX}-br`);
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 120,
    box!.y + box!.height / 2 + 120,
    { steps: 12 }
  );
  await page.mouse.up();

  const after = await boxRect(page);
  expect(after!.width).toBeGreaterThan(before!.width + 5);

  const ratioBefore = before!.width / before!.height;
  const ratioAfter = after!.width / after!.height;
  expect(Math.abs(ratioAfter - ratioBefore)).toBeLessThan(0.02);

  // The opposite corner is the anchor, so the top-left must not have moved.
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
});

test("turning the switch off makes dragging inert", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  await openOverlays(page);
  const toggle = page.getByRole("switch", {
    name: "Show resize and reposition containers",
  });

  await toggle.click();
  await expect(page.getByTestId(`overlay-container-${BOX}`)).toBeVisible({
    timeout: 10_000,
  });
  const rect = await boxRect(page);

  await toggle.click();
  await expect(page.getByTestId(`overlay-container-${BOX}`)).toHaveCount(0);

  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect!.x + rect!.width / 2 + 150,
    rect!.y + rect!.height / 2 + 150,
    { steps: 10 }
  );
  await page.mouse.up();

  await toggle.click();
  const after = await boxRect(page);
  expect(Math.abs(after!.x - rect!.x)).toBeLessThan(2);
  expect(Math.abs(after!.y - rect!.y)).toBeLessThan(2);
});

test("the Preview tab carries only the preview and the transcript", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAsOwner(page);
  await page.goto("/live");
  await page.getByRole("tab", { name: "Preview" }).click();

  await expect(page.getByText("Live transcription")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("overlays-stage")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit overlays" })
  ).toHaveCount(0);
  await expect(page.getByText("Playback health")).toHaveCount(0);
});

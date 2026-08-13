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
  await settle(page);
}

// Overlays first render at their defaults and jump to the saved layout when it
// arrives. Measuring before that lands reads a position nobody chose, so wait
// until two consecutive samples agree.
async function settle(page: Page) {
  let previous: string | null = null;
  for (let i = 0; i < 40; i += 1) {
    const current = JSON.stringify(await boxGeometry(page));
    if (current !== "null" && current === previous) return;
    previous = current;
    await page.waitForTimeout(250);
  }
  throw new Error("the overlay layout never settled");
}

// The members strip is always visible by default and has a stable box, so it is
// the one used for geometry.
const BOX = "members";

// The overlay's position is a canvas coordinate, and the canvas is itself
// scaled to fit the panel. Viewport pixels therefore move whenever the stage
// re-measures, which says nothing about the overlay. Position is read from the
// box's own left/top in canvas units; only size is read from the viewport,
// where the ratio is what matters and the common factor cancels.
// Read from the positioned box, which exists whether or not resize mode is on.
// Reading from the container would mean toggling the mode to take a
// measurement, and the layout autosaves and rehydrates in between, which moves
// the box for reasons that have nothing to do with what is being tested.
async function boxGeometry(page: Page) {
  return page.evaluate((boxKey) => {
    const positioned = document.querySelector(
      `[data-testid="overlay-box-${boxKey}"]`
    ) as HTMLElement | null;
    if (!positioned) return null;
    const rect = positioned.getBoundingClientRect();
    return {
      left: parseFloat(positioned.style.left || "0"),
      top: parseFloat(positioned.style.top || "0"),
      width: rect.width,
      height: rect.height,
    };
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

test("empty overlays are on screen with nothing live and demo off", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAsOwner(page);
  await openOverlays(page);
  const stage = page.getByTestId("overlays-stage");

  // The whole point of the tab: the layout is there without inventing data.
  // An empty leaderboard draws nothing, so it is present rather than visible,
  // which is what makes it positionable once resize mode is on.
  await expect(stage.getByTestId("competition-ladder")).toBeAttached();
  await expect(stage.locator("mask#ring-track-subs")).toHaveCount(1);
  await expect(stage.locator("mask#ring-track-likes")).toHaveCount(1);
  await expect(stage.locator("mask#ring-track-viewers")).toHaveCount(1);

  // The one overlay with no resting state stays out of the way.
  await expect(
    stage.locator("div.border-dashed", { hasText: "Highlight" })
  ).toHaveCount(0);
});

test("the panel is toggled from beside the tabs, not from the stage", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await loginAsOwner(page);
  await openOverlays(page);

  const toggle = page.getByRole("button", { name: "Hide overlay controls" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();

  const reopen = page.getByRole("button", { name: "Show overlay controls" });
  await expect(reopen).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByTestId("overlays-stage").getByRole("button", { name: "Overlays" })
  ).toHaveCount(0);

  await reopen.click();
  await expect(
    page.getByRole("button", { name: "Hide overlay controls" })
  ).toHaveAttribute("aria-pressed", "true");
});

test("every overlay is grabbable at a narrow width, with the tabs on their own line", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 620, height: 900 });
  await loginAsOwner(page);
  await openOverlays(page);
  await page
    .getByRole("switch", { name: "Show resize and reposition containers" })
    .click();

  // Which overlays are enabled is the owner's choice, so the property under
  // test is that whatever is on the stage can be grabbed — including anything
  // currently drawing nothing, which would otherwise collapse to no size.
  const containers = page.locator('[data-testid^="overlay-container-"]');
  await expect(containers.first()).toBeVisible({ timeout: 20_000 });
  const count = await containers.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const box = await containers.nth(i).boundingBox();
    expect(box, `container ${i} has no box`).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  }

  // The reflow is judged on the Activity tab, which is the one carrying
  // controls on the right of the header for the tabs to be pushed above.
  await page.getByRole("tab", { name: "Activity" }).click();
  const demoSwitch = page.getByRole("switch", {
    name: "Show simulated activity",
  });
  await expect(demoSwitch).toBeVisible({ timeout: 10_000 });

  const tabs = await page.getByRole("tablist").boundingBox();
  const control = await demoSwitch.boundingBox();
  expect(control!.y).toBeGreaterThan(tabs!.y + tabs!.height - 2);
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

  const before = await boxGeometry(page);
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

  const after = await boxGeometry(page);
  expect(after!.width).toBeGreaterThan(before!.width + 5);

  const ratioBefore = before!.width / before!.height;
  const ratioAfter = after!.width / after!.height;
  expect(Math.abs(ratioAfter - ratioBefore)).toBeLessThan(0.02);

  // The bottom-right handle anchors the top-left, which must not move at all.
  expect(after!.left).toBeCloseTo(before!.left, 3);
  expect(after!.top).toBeCloseTo(before!.top, 3);
});

test("turning the switch off makes dragging inert", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAsOwner(page);
  await openOverlays(page);
  const toggle = page.getByRole("switch", {
    name: "Show resize and reposition containers",
  });

  // Never turned on: the box is read through its positioned wrapper, so the
  // measurement does not depend on the mode being toggled.
  await expect(page.getByTestId(`overlay-box-${BOX}`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId(`overlay-container-${BOX}`)).toHaveCount(0);

  const before = await boxGeometry(page);
  const grab = await page.getByTestId(`overlay-box-${BOX}`).boundingBox();

  await page.mouse.move(grab!.x + grab!.width / 2, grab!.y + grab!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grab!.x + grab!.width / 2 + 150,
    grab!.y + grab!.height / 2 + 150,
    { steps: 10 }
  );
  await page.mouse.up();

  const after = await boxGeometry(page);
  expect(after!.left).toBeCloseTo(before!.left, 3);
  expect(after!.top).toBeCloseTo(before!.top, 3);

  // And the mode still works when asked for.
  await toggle.click();
  await expect(page.getByTestId(`overlay-container-${BOX}`)).toBeVisible({
    timeout: 10_000,
  });
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

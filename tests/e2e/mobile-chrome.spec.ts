import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

import type { Json } from "../../supabase/types";

let ownerChannelId: string;
let savedLayout: Json = null;
let hadLayoutRow = false;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;

  const { data: row } = await admin
    .from("demo_layouts")
    .select("config")
    .eq("channel_id", ownerChannelId)
    .maybeSingle();
  hadLayoutRow = !!row;
  savedLayout = row?.config ?? null;

  await admin.from("demo_layouts").upsert(
    {
      channel_id: ownerChannelId,
      config: {
        visible: { highlight: false },
        mobileChrome: false,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "channel_id" }
  );
});

test.afterAll(async () => {
  if (hadLayoutRow) {
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

async function openDemoStageWithChrome(page: Page, hydrationProbe: string) {
  await page.goto("/live");
  await expect(
    page.getByRole("tab", { name: "Settings" })
  ).toBeVisible({ timeout: 20_000 });
  const demoSwitch = page
    .locator('div:has(> span:text-is("Demo"))')
    .getByRole("switch");
  await demoSwitch.click();
  await expect(page.getByText("Overlays", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Wait for the saved layout to hydrate before touching switches, using a
  // known difference between the DB config and the defaults as the signal.
  const probe = page
    .locator("label")
    .filter({ hasText: hydrationProbe })
    .getByRole("switch");
  await expect(probe).toHaveAttribute("data-state", "unchecked", {
    timeout: 15_000,
  });
  const mobileRow = page
    .locator("label")
    .filter({ hasText: "Mobile layout" })
    .getByRole("switch");
  if ((await mobileRow.getAttribute("data-state")) !== "checked") {
    await mobileRow.click();
  }
  await expect(page.getByText("Subscribe", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
}

async function chromeGeometry(page: Page) {
  return page.evaluate(() => {
    const subscribe = [...document.querySelectorAll("span")].find(
      (el) => el.textContent === "Subscribe"
    );
    const topBar = subscribe?.parentElement?.parentElement ?? null;
    const anchor = topBar?.parentElement?.parentElement ?? null;
    if (!subscribe || !topBar || !anchor) return null;
    const a = anchor.getBoundingClientRect();
    const t = topBar.getBoundingClientRect();
    const s = subscribe.getBoundingClientRect();
    const input = [...document.querySelectorAll("span")].find(
      (el) => el.textContent === "Chat..."
    );
    const i = input?.parentElement?.getBoundingClientRect() ?? null;
    return {
      anchorW: a.width,
      anchorH: a.height,
      anchorBottom: a.bottom,
      topBarH: t.height,
      subscribeW: s.width,
      inputBottom: i?.bottom ?? 0,
      inputH: i?.height ?? 0,
    };
  });
}

test("demo stage mobile chrome keeps reference proportions at two sizes", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  await loginAsOwner(page);

  await page.setViewportSize({ width: 1400, height: 900 });
  await openDemoStageWithChrome(page, "Highlight");

  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("demo_layouts")
          .select("config")
          .eq("channel_id", ownerChannelId)
          .maybeSingle();
        return (data?.config as { mobileChrome?: boolean } | null)
          ?.mobileChrome;
      },
      { message: "toggle persists to demo_layouts", timeout: 10_000 }
    )
    .toBe(true);

  await page.screenshot({
    path: "test-results/mobile-chrome-demo-large.png",
    fullPage: false,
  });
  const large = await chromeGeometry(page);
  expect(large, "chrome geometry resolvable at large size").toBeTruthy();
  expect(large!.topBarH / large!.anchorW).toBeCloseTo(96 / 1080, 2);
  expect(large!.subscribeW / large!.anchorW).toBeCloseTo(200 / 1080, 2);
  const overlapLarge =
    (large!.anchorBottom - (large!.inputBottom - large!.inputH)) /
    large!.inputH;
  expect(
    overlapLarge,
    "a quarter of the input overlaps the video bottom"
  ).toBeCloseTo(0.25, 1);

  await page.setViewportSize({ width: 1000, height: 700 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "test-results/mobile-chrome-demo-small.png",
    fullPage: false,
  });
  const small = await chromeGeometry(page);
  expect(small, "chrome geometry resolvable at small size").toBeTruthy();
  expect(small!.anchorW, "stage rescaled").toBeLessThan(large!.anchorW);
  expect(small!.topBarH / small!.anchorW).toBeCloseTo(96 / 1080, 2);
  expect(small!.subscribeW / small!.anchorW).toBeCloseTo(200 / 1080, 2);

  await page.reload();
  await page
    .locator('div:has(> span:text-is("Demo"))')
    .getByRole("switch")
    .click();
  await expect(
    page.getByText("Subscribe", { exact: true }),
    "mobile layout persists across reload"
  ).toBeVisible({ timeout: 15_000 });

  const mobileRow = page
    .locator("label")
    .filter({ hasText: "Mobile layout" })
    .getByRole("switch");
  await mobileRow.click();
  await expect(page.getByText("Subscribe", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "test-results/mobile-chrome-demo-off.png",
    fullPage: false,
  });

  await mobileRow.click();
  await expect(page.getByText("Subscribe", { exact: true })).toBeVisible();
  await mobileRow.click();
  await expect(page.getByText("Subscribe", { exact: true })).toHaveCount(0);
});

test("real preview disables the switch for a landscape stream", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  // CSP restricts media-src to the app's own origins, so the landscape test
  // stream is generated locally and served from public/ ('self').
  const fixtureDir = join(process.cwd(), "public", "e2e-fixtures");
  mkdirSync(fixtureDir, { recursive: true });
  const ffmpegArgs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=320x180:rate=15:duration=4",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-f",
    "hls",
    "-hls_time",
    "2",
    "-hls_list_size",
    "0",
    join(fixtureDir, "e2e-land.m3u8"),
  ];
  try {
    execFileSync(process.env.FFMPEG_BIN ?? "ffmpeg", ffmpegArgs);
  } catch {
    execFileSync("ffmpeg", ffmpegArgs);
  }
  const port = process.env.PLAYWRIGHT_PORT ?? "3000";

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: `http://localhost:${port}/e2e-fixtures/e2e-land.m3u8`,
      title: `E2E mobile chrome landscape ${Date.now()}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  try {
    await loginAsOwner(page);
    await page.goto("/live");
    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(page.locator("video")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByText("Mobile layout (vertical streams only)")
    ).toBeVisible({ timeout: 30_000 });
    const chip = page
      .locator("div")
      .filter({ hasText: /^Mobile layout \(vertical streams only\)$/ })
      .getByRole("switch");
    await expect(chip).toBeDisabled();
    await page.screenshot({
      path: "test-results/mobile-chrome-landscape-disabled.png",
    });
  } finally {
    await admin.from("streams").delete().eq("id", live!.id);
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../supabase/types";

// A frame in the DOM is not evidence — a frame blocked by the Content-Security-Policy is also in the DOM.
// The evidence is that content INSIDE the frame is reachable, plus the absence of a policy violation.
//
// The owner's saved layout is switched on for the duration of the run and put back afterwards, which is
// the same pattern the demo-interactivity spec uses: the layout row is the only place a surface can be
// turned on, and the alternative is testing something other than what OBS loads.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerSlug: string;
let ownerChannelId: string;
let overlayToken: string | null = null;
let savedLayout: Json | null = null;
let installId: string | null = null;

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

  const { data: layout } = await admin
    .from("overlay_layouts")
    .select("config, token")
    .eq("channel_id", ownerChannelId)
    .maybeSingle();
  savedLayout = layout?.config ?? null;
  overlayToken = layout?.token ?? null;

  const { data: install } = await admin
    .from("channel_overlays")
    .select("id")
    .eq("channel_id", ownerChannelId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  installId = install?.id ?? null;

  if (savedLayout) {
    const config = savedLayout as Record<string, unknown>;
    const visible = (config.visible ?? {}) as Record<string, boolean>;
    await admin.from("overlay_layouts").upsert(
      {
        channel_id: ownerChannelId,
        config: { ...config, visible: { ...visible, game: true } } as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" }
    );
  }
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

test("the game window frames the game and is not refused by the security policy", async ({
  page,
}) => {
  test.skip(!overlayToken, "no overlay layout to read");
  test.skip(!installId, "no overlay installed on the owner's channel");

  const violations: string[] = [];
  page.on("console", (m) => {
    if (/content security policy/i.test(m.text())) violations.push(m.text());
  });

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${overlayToken}`);

  const frame = page.locator('[data-testid="game-window"]');
  await expect(frame).toBeVisible({ timeout: 25_000 });

  // The address is per channel, not per deployment: what is framed names this
  // channel's installation.
  await expect(frame).toHaveAttribute("src", new RegExp(`install=${installId}`));

  // Reaching inside proves the document loaded rather than being blocked.
  const inner = page.frameLocator('[data-testid="game-window"]').locator("canvas");
  await expect(inner).toBeAttached({ timeout: 60_000 });

  // Two shots of the window itself: a still creature would mean the frame loaded but nothing is running.
  await page.waitForTimeout(6_000);
  const before = await frame.screenshot({
    path: "test-results/game-window-t0.png",
  });
  await page.waitForTimeout(20_000);
  const after = await frame.screenshot({
    path: "test-results/game-window-t1.png",
  });
  expect(before.equals(after)).toBe(false);

  expect(violations, violations.join(" | ")).toHaveLength(0);
});

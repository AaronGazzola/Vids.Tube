import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database, Json } from "../../supabase/types";

// The overlay's own address is intercepted and answered with a document that
// loads the REAL SDK. That matters: the frame is genuinely on the permitted
// origin, so the origin checks on both ends are exercised rather than stubbed,
// and the SDK under test is the file an overlay author would load.
//
// The saved layout and the overlay's declaration are put back afterwards, the
// pattern the game-window and overlay-settings specs use.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SDK = readFileSync(
  join(process.cwd(), "public", "overlay-sdk.js"),
  "utf8"
);

const FIELDS = [
  { key: "mood", label: "Mood", type: "text", default: "calm" },
] as unknown as Json;

const framePage = `<!doctype html>
<meta charset="utf-8">
<body style="margin:0;background:transparent">
<pre id="state">waiting</pre>
<script type="module">
${SDK}
const overlay = connectOverlay();
const draw = () => {
  document.getElementById("state").textContent = JSON.stringify({
    channel: overlay.channel,
    settings: overlay.settings,
    box: overlay.box,
  });
};
overlay.onHello(draw);
overlay.onSettings(draw);
overlay.onBox(draw);
</script>
</body>`;

let ownerSlug: string;
let ownerChannelId: string;
let overlayToken: string | null = null;
let overlayId: string;
let installId: string;
let savedLayout: Json | null = null;
let savedFields: Json = [];
let savedSettings: Json = {};
let framePattern: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const configured = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!configured) return;
  framePattern = `${new URL(configured).origin}/**`;

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
    .select("id, overlay_id, settings")
    .eq("channel_id", ownerChannelId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (!install) return;
  installId = install.id;
  overlayId = install.overlay_id;
  savedSettings = install.settings;

  const { data: overlay } = await admin
    .from("overlays")
    .select("settings_fields")
    .eq("id", overlayId)
    .maybeSingle();
  savedFields = overlay?.settings_fields ?? [];

  await admin
    .from("overlays")
    .update({ settings_fields: FIELDS })
    .eq("id", overlayId);
  await admin
    .from("channel_overlays")
    .update({ settings: {} as unknown as Json })
    .eq("id", installId);

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
  if (overlayId) {
    await admin
      .from("overlays")
      .update({ settings_fields: savedFields })
      .eq("id", overlayId);
    await admin
      .from("channel_overlays")
      .update({ settings: savedSettings })
      .eq("id", installId);
  }
});

test("a frame that announces itself is told its channel, settings and box", async ({
  page,
}) => {
  test.skip(!overlayToken || !installId, "no installed overlay to frame");

  await page.route(framePattern, (route) =>
    route.fulfill({ contentType: "text/html", body: framePage })
  );

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${overlayToken}`);

  const state = page
    .frameLocator('[data-testid="game-window"]')
    .locator("#state");
  await expect(state).not.toHaveText("waiting", { timeout: 20_000 });

  const seen = JSON.parse((await state.textContent())!) as {
    channel: string;
    settings: Record<string, unknown>;
    box: { width: number; height: number; scale: number };
  };
  expect(seen.channel).toBe(ownerChannelId);
  // The declared default is filled in, so the overlay never sees a gap for a
  // field it asked for.
  expect(seen.settings).toEqual({ mood: "calm" });
  expect(seen.box.width).toBeGreaterThan(0);
  expect(seen.box.height).toBeGreaterThan(0);
  expect(seen.box.scale).toBeGreaterThan(0);
});

test("a saved change reaches the running frame without reloading it", async ({
  page,
}) => {
  test.skip(!overlayToken || !installId, "no installed overlay to frame");

  await page.route(framePattern, (route) =>
    route.fulfill({ contentType: "text/html", body: framePage })
  );

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${overlayToken}`);

  const frame = page.locator('[data-testid="game-window"]');
  const state = page
    .frameLocator('[data-testid="game-window"]')
    .locator("#state");
  await expect(state).toContainText("calm", { timeout: 20_000 });
  const srcBefore = await frame.getAttribute("src");

  await admin
    .from("channel_overlays")
    .update({ settings: { mood: "lively" } as unknown as Json })
    .eq("id", installId);

  // Within one refetch of the installation the route already polls.
  await expect(state).toContainText("lively", { timeout: 30_000 });

  // The entire point: the overlay received it while still running.
  expect(await frame.getAttribute("src")).toBe(srcBefore);
});

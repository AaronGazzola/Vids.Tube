import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database, Json } from "../../supabase/types";

// The same intercepted frame the message-channel spec uses, loading the real SDK
// on the permitted origin. What is proven here is the whole path: a row in
// command_events, through the registry lookup, out to a running overlay.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SDK = readFileSync(join(process.cwd(), "public", "overlay-sdk.js"), "utf8");

const KEYWORD = "eventprobe";

const framePage = `<!doctype html>
<meta charset="utf-8">
<body style="margin:0;background:transparent">
<pre id="events">[]</pre>
<script type="module">
${SDK}
const overlay = connectOverlay();
const seen = [];
overlay.onEvent((event) => {
  seen.push(event);
  document.getElementById("events").textContent = JSON.stringify(seen);
});
</script>
</body>`;

let ownerSlug: string;
let ownerChannelId: string;
let overlayToken: string | null = null;
let overlayId: string;
let streamId: string | null = null;
let savedLayout: Json | null = null;
let savedCommands: Json = [];
let framePattern: string;
const insertedEventIds: string[] = [];

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
    .select("overlay_id")
    .eq("channel_id", ownerChannelId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (!install) return;
  overlayId = install.overlay_id;

  const { data: overlay } = await admin
    .from("overlays")
    .select("commands")
    .eq("id", overlayId)
    .maybeSingle();
  savedCommands = overlay?.commands ?? [];

  // command_events requires a stream, so the most recent one is borrowed. Rows
  // are deleted afterwards by id.
  const { data: stream } = await admin
    .from("streams")
    .select("id")
    .eq("channel_id", ownerChannelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  streamId = stream?.id ?? null;

  await admin
    .from("chat_commands")
    .insert({
      channel_id: ownerChannelId,
      overlay_id: overlayId,
      keyword: KEYWORD,
      kind: "overlay",
      description: "A probe command",
    });

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
  if (insertedEventIds.length > 0) {
    await admin.from("command_events").delete().in("id", insertedEventIds);
  }
  if (ownerChannelId) {
    await admin
      .from("chat_commands")
      .delete()
      .eq("channel_id", ownerChannelId)
      .eq("keyword", KEYWORD);
  }
  if (overlayId) {
    await admin
      .from("overlays")
      .update({ commands: savedCommands })
      .eq("id", overlayId);
  }
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

async function runCommand(args: string) {
  const { data, error } = await admin
    .from("command_events")
    .insert({
      channel_id: ownerChannelId,
      stream_id: streamId!,
      origin: "vidstube",
      participant_key: "a-chatter",
      keyword: KEYWORD,
      args,
      status: "executed",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  insertedEventIds.push(data!.id);
}

test("a chatter's command reaches the running overlay, once", async ({ page }) => {
  test.skip(!overlayToken || !overlayId, "no installed overlay to frame");
  test.skip(!streamId, "no stream to attribute a command to");

  await page.route(framePattern, (route) =>
    route.fulfill({ contentType: "text/html", body: framePage })
  );

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${overlayToken}`);

  const frame = page.locator('[data-testid="game-window"]');
  const events = page
    .frameLocator('[data-testid="game-window"]')
    .locator("#events");
  await expect(events).toHaveText("[]", { timeout: 20_000 });
  const srcBefore = await frame.getAttribute("src");

  await runCommand("first");
  await expect(events).toContainText("first", { timeout: 20_000 });

  const seen = JSON.parse((await events.textContent())!) as {
    keyword: string;
    args: string;
    actor: string;
  }[];
  expect(seen).toHaveLength(1);
  expect(seen[0].keyword).toBe(KEYWORD);
  expect(seen[0].args).toBe("first");
  expect(seen[0].actor).toBeTruthy();
  // Opaque: the participant key must not be recoverable from what the overlay
  // was told.
  expect(seen[0].actor).not.toContain("a-chatter");

  // Several polls later, still exactly one: an event is never delivered twice.
  await page.waitForTimeout(6_000);
  expect(
    JSON.parse((await events.textContent())!) as unknown[]
  ).toHaveLength(1);

  await runCommand("second");
  await expect(events).toContainText("second", { timeout: 20_000 });
  expect(
    JSON.parse((await events.textContent())!) as unknown[]
  ).toHaveLength(2);

  // The overlay received all of it while still running.
  expect(await frame.getAttribute("src")).toBe(srcBefore);
});

import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { mintInstallationToken } from "../../lib/overlay-token";
import type { Database, Json } from "../../supabase/types";

// The overlay's own declaration is put in place for the run and restored after,
// the same pattern the game-window spec uses on the saved layout: the declaration
// is the only place a field can come from, and the alternative is testing
// something other than what an overlay actually reads.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FIELDS = [
  {
    key: "scale",
    label: "Scale",
    type: "number",
    default: 1,
    min: 0.5,
    max: 2,
    step: 0.1,
  },
  { key: "chime", label: "Chime", type: "toggle", default: false },
];

let overlayId: string;
let channelId: string;
let installId: string;
let secret: string;
let savedFields: Json = [];
let savedSettings: Json = {};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: install } = await admin
    .from("channel_overlays")
    .select("id, overlay_id, channel_id, settings")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (!install) return;
  installId = install.id;
  overlayId = install.overlay_id;
  channelId = install.channel_id;
  savedSettings = install.settings;

  const { data: overlay } = await admin
    .from("overlays")
    .select("settings_fields")
    .eq("id", overlayId)
    .maybeSingle();
  savedFields = overlay?.settings_fields ?? [];

  const { data: row } = await admin
    .from("overlay_secrets")
    .select("secret")
    .eq("overlay_id", overlayId)
    .maybeSingle();
  secret = row?.secret ?? "";
  if (!secret) return;

  await admin
    .from("overlays")
    .update({ settings_fields: FIELDS as unknown as Json })
    .eq("id", overlayId);
  await admin
    .from("channel_overlays")
    .update({ settings: { scale: 1.5 } as unknown as Json })
    .eq("id", installId);
});

test.afterAll(async () => {
  if (!secret) return;
  await admin
    .from("overlays")
    .update({ settings_fields: savedFields })
    .eq("id", overlayId);
  await admin
    .from("channel_overlays")
    .update({ settings: savedSettings })
    .eq("id", installId);
});

function mint(nowS = Math.floor(Date.now() / 1000)) {
  return mintInstallationToken(
    { overlayId, channelId, installId, secret },
    nowS
  );
}

function read(request: APIRequestContext, token: string | null) {
  return request.get("/api/overlay/settings", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

test("an overlay reads what the streamer set, with defaults filled in", async ({
  request,
}) => {
  test.skip(!secret, "no installed overlay with a secret");
  const response = await read(request, mint());
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    settings: Record<string, unknown>;
  };
  // scale was set by the streamer; chime was never set and comes from the
  // declared default, so the overlay never sees a gap for a field it declared.
  expect(body.settings).toEqual({ scale: 1.5, chime: false });
});

test("every refusal looks the same", async ({ request }) => {
  test.skip(!secret, "no installed overlay with a secret");
  const nowS = Math.floor(Date.now() / 1000);
  const responses = [
    await read(request, null),
    await read(request, "not-a-token"),
    await read(request, mint(nowS - 13 * 60 * 60)),
    await read(
      request,
      mintInstallationToken(
        { overlayId, channelId, installId, secret: "wrong" },
        nowS
      )
    ),
  ];

  const seen = new Set<string>();
  for (const response of responses) {
    seen.add(`${response.status()} ${await response.text()}`);
  }
  expect(seen.size).toBe(1);
  expect(responses[0].status()).toBe(401);
});

test("a token cannot read an installation it does not name", async ({
  request,
}) => {
  test.skip(!secret, "no installed overlay with a secret");
  const forInstall = mintInstallationToken(
    {
      overlayId,
      channelId,
      installId: "00000000-0000-4000-8000-000000000000",
      secret,
    },
    Math.floor(Date.now() / 1000)
  );
  const response = await read(request, forInstall);
  expect(response.status()).toBe(401);
});

// The editor and the endpoint must agree on one stored object, or a streamer
// configures something the overlay never sees.
test("what the streamer sets in the panel is what the overlay reads", async ({
  page,
  request,
}) => {
  test.skip(!secret, "no installed overlay with a secret");
  test.skip(
    !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD,
    "no owner credentials configured"
  );

  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");

  await page.goto("/live");
  await page.getByRole("tab", { name: "Overlays" }).click();

  // Scoped to the panel: /live carries its own Save and Discard for the
  // broadcast, and matching those would prove nothing about these.
  const panel = page.getByTestId("overlay-settings");
  await expect(panel).toBeVisible({ timeout: 20_000 });

  const chime = panel.getByLabel("Chime", { exact: true });
  await expect(chime).toHaveAttribute("data-state", "unchecked");
  await chime.click();

  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Discard", exact: true })
  ).toHaveCount(0, { timeout: 15_000 });

  const response = await read(request, mint());
  const body = (await response.json()) as { settings: Record<string, unknown> };
  expect(body.settings.chime).toBe(true);
});

test("the framed origin is allowed to call it", async ({ request }) => {
  const configured = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  test.skip(!configured, "no game origin configured");
  const response = await request.fetch("/api/overlay/settings", {
    method: "OPTIONS",
  });
  expect(response.headers()["access-control-allow-origin"]).toBe(
    new URL(configured!).origin
  );
  expect(response.headers()["access-control-allow-headers"]).toContain(
    "authorization"
  );
});

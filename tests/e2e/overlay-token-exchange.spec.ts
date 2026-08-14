import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  mintInstallationToken,
  verifyOverlayToken,
  type OverlayTokenClaims,
} from "../../lib/overlay-token";
import type { Database } from "../../supabase/types";

// Exercised against the running route rather than against the function, because
// what is being checked is that a framed overlay on another origin can renew
// without reloading: the headers are as much the subject as the crypto.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let overlayId: string;
let channelId: string;
let installId: string;
let secret: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: install } = await admin
    .from("channel_overlays")
    .select("id, overlay_id, channel_id")
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (!install) return;
  installId = install.id;
  overlayId = install.overlay_id;
  channelId = install.channel_id;

  const { data: row } = await admin
    .from("overlay_secrets")
    .select("secret")
    .eq("overlay_id", overlayId)
    .maybeSingle();
  secret = row?.secret ?? "";
});

function mint(nowS: number) {
  return mintInstallationToken(
    { overlayId, channelId, installId, secret },
    nowS
  );
}

async function exchange(request: import("@playwright/test").APIRequestContext, token: string) {
  return request.post("/api/overlay/token", { data: { token } });
}

test("a live token is exchanged for a later one naming the same subject", async ({
  request,
}) => {
  test.skip(!secret, "no installed overlay with a secret");
  const nowS = Math.floor(Date.now() / 1000);
  const original = mint(nowS);

  const response = await exchange(request, original);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { token: string; expiresAt: number };

  const before = verifyOverlayToken(original, secret) as OverlayTokenClaims;
  const after = verifyOverlayToken(body.token, secret) as OverlayTokenClaims;
  expect(after).not.toBeNull();
  expect(after.aud).toBe(before.aud);
  expect(after.channel).toBe(before.channel);
  expect(after.install).toBe(before.install);
  expect(after.sub).toBe(before.sub);
  expect(after.viewerKind).toBe("source");
  expect(after.exp).toBeGreaterThanOrEqual(before.exp);
  // A reissued token is its own token, or the two are indistinguishable in a log.
  expect(after.jti).not.toBe(before.jti);
});

test("an expired token is refused", async ({ request }) => {
  test.skip(!secret, "no installed overlay with a secret");
  const longAgo = Math.floor(Date.now() / 1000) - 13 * 60 * 60;
  const response = await exchange(request, mint(longAgo));
  expect(response.status()).toBe(401);
});

test("a token signed with another secret is refused", async ({ request }) => {
  test.skip(!secret, "no installed overlay with a secret");
  const nowS = Math.floor(Date.now() / 1000);
  const forged = mintInstallationToken(
    { overlayId, channelId, installId, secret: "not-this-overlay's-secret" },
    nowS
  );
  const response = await exchange(request, forged);
  expect(response.status()).toBe(401);
});

// A caller must not be able to tell an expired token from a forged one, or from
// an overlay that no longer exists.
test("every refusal looks the same", async ({ request }) => {
  test.skip(!secret, "no installed overlay with a secret");
  const nowS = Math.floor(Date.now() / 1000);
  const cases = [
    mint(nowS - 13 * 60 * 60),
    mintInstallationToken(
      { overlayId, channelId, installId, secret: "wrong" },
      nowS
    ),
    mintInstallationToken(
      {
        overlayId: "00000000-0000-4000-8000-000000000000",
        channelId,
        installId,
        secret,
      },
      nowS
    ),
    "not-a-token",
  ];

  const seen = new Set<string>();
  for (const token of cases) {
    const response = await exchange(request, token);
    seen.add(`${response.status()} ${await response.text()}`);
  }
  expect(seen.size).toBe(1);
});

test("the framed origin is allowed to call it from another origin", async ({
  request,
}) => {
  test.skip(!secret, "no installed overlay with a secret");
  const configured = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  test.skip(!configured, "no game origin configured");
  const expected = new URL(configured!).origin;

  const response = await request.fetch("/api/overlay/token", {
    method: "OPTIONS",
  });
  expect(response.headers()["access-control-allow-origin"]).toBe(expected);
});

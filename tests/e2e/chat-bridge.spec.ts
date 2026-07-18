import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
});

test.afterAll(async () => {
  await admin
    .from("streams")
    .delete()
    .eq("channel_id", ownerChannelId)
    .like("title", "E2E chat bridge%");
});

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  return (count ?? 0) > 0;
}

async function bridgeEnabledInDb(): Promise<boolean | null> {
  const { data: stream } = await admin
    .from("streams")
    .select("id")
    .eq("channel_id", ownerChannelId)
    .like("title", "E2E chat bridge%")
    .maybeSingle();
  if (!stream) return null;
  const { data } = await admin
    .from("chat_scoring_state")
    .select("bridge_enabled")
    .eq("stream_id", stream.id)
    .maybeSingle();
  return data?.bridge_enabled ?? null;
}

test("the bridge toggle defaults on and round-trips through Save", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");

  await page.goto("/live");
  const bridgeSwitch = page.getByRole("switch", {
    name: "Bridge chat to YouTube",
  });
  await expect(bridgeSwitch).toBeVisible({ timeout: 20_000 });
  await expect(bridgeSwitch).toHaveAttribute("data-state", "checked");

  await page.fill("#title", "E2E chat bridge");
  await bridgeSwitch.click();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect
    .poll(async () => bridgeEnabledInDb(), { timeout: 20_000 })
    .toBe(false);

  await bridgeSwitch.click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(async () => bridgeEnabledInDb(), { timeout: 20_000 })
    .toBe(true);
});

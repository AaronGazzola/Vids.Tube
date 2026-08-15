import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../supabase/types";

// The whole chain, with nothing stubbed: a row in command_events, through the
// command registry, out over the message channel, into the real eco3d overlay,
// and onto the creature. The frame here is the actual game, not an intercepted
// stand-in, so this is the test that says the two products are connected.
//
// It reads the game's state through the read-only `__game` observation handle the
// embed page exposes, in the spirit of `__studio` and docs/observation-loop.md:
// a creature being fed changes nothing a camera can see.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerSlug: string;
let ownerChannelId: string;
let overlayToken: string | null = null;
let streamId: string | null = null;
let savedLayout: Json | null = null;
const insertedEventIds: string[] = [];
// The chat rows have to be tracked and removed too. They were not, and every run
// left a real "!feed" in the owner's real stream: fourteen accumulated on a
// scheduled stream before anyone noticed, showing in the activity panel and in
// the stream's chat, indistinguishable at a glance from something a viewer had
// typed. A command_event is invisible plumbing; a chat message is content on
// somebody's channel, and this test writes to the production database.
const insertedMessageIds: string[] = [];

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

  const { data: stream } = await admin
    .from("streams")
    .select("id")
    .eq("channel_id", ownerChannelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  streamId = stream?.id ?? null;

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
  // Events first: a command_event references the chat message it came from, so
  // removing the message while the event still points at it would either fail or
  // orphan the event, depending on which way the constraint runs.
  if (insertedEventIds.length > 0) {
    await admin.from("command_events").delete().in("id", insertedEventIds);
  }
  if (insertedMessageIds.length > 0) {
    await admin.from("chat_messages").delete().in("id", insertedMessageIds);
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

async function feedFromChat(author: string) {
  const { data: message, error: messageError } = await admin
    .from("chat_messages")
    .insert({
      stream_id: streamId!,
      body: "!feed",
      origin: "youtube",
      author_name: author,
      external_author_id: `external-${author}`,
    })
    .select("id")
    .maybeSingle();
  if (messageError) throw new Error(messageError.message);
  insertedMessageIds.push(message!.id);

  const { data, error } = await admin
    .from("command_events")
    .insert({
      channel_id: ownerChannelId,
      stream_id: streamId!,
      chat_message_id: message!.id,
      origin: "youtube",
      participant_key: `youtube:external-${author}`,
      keyword: "feed",
      status: "executed",
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  insertedEventIds.push(data!.id);
  return message!.id;
}

type CreatureState = {
  hunger: number;
  feedCount: number;
  lastFedBy: string | null;
};

async function creature(page: import("@playwright/test").Page) {
  return page
    .frameLocator('[data-testid="game-window"]')
    .locator("body")
    .evaluate(() => {
      const w = window as unknown as {
        __game?: { state: () => { creature: CreatureState } };
      };
      return w.__game ? w.__game.state().creature : null;
    }) as Promise<CreatureState | null>;
}

test("a chatter feeds the dragon", async ({ page }) => {
  test.skip(!overlayToken, "no overlay layout to read");
  test.skip(!streamId, "no stream to attribute a command to");

  const messages: string[] = [];
  page.on("console", (m) => messages.push(m.text()));

  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${overlayToken}`);

  await expect(page.locator('[data-testid="game-window"]')).toBeVisible({
    timeout: 25_000,
  });

  // The game has to be running before it can be fed.
  await expect
    .poll(async () => (await creature(page))?.feedCount, { timeout: 60_000 })
    .toBe(0);

  const before = (await creature(page))!;

  await feedFromChat("Bob");

  await expect
    .poll(async () => (await creature(page))?.feedCount, { timeout: 30_000 })
    .toBe(1);

  const after = (await creature(page))!;
  // Fed, and credited to the chatter by the name chat shows.
  expect(after.lastFedBy).toBe("Bob");
  expect(after.hunger).toBeLessThan(before.hunger);

  // A second chatter is a second actor, and the credit moves.
  await feedFromChat("Ada");
  await expect
    .poll(async () => (await creature(page))?.lastFedBy, { timeout: 30_000 })
    .toBe("Ada");
  expect((await creature(page))!.feedCount).toBe(2);

  expect(
    messages.filter((m) => /no game action for the command/.test(m)),
    "no command was delivered that the game could not map"
  ).toHaveLength(0);
});

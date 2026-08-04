import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stamp = Date.now();
const MESSAGE_COUNT = 200;
const NARROW = { width: 375, height: 720 };

let ownerChannelId: string;
let ownerSlug: string;
let ownerUserId: string;
let hasActiveRow = false;
let vodStreamId: string | null = null;
let vodVideoId: string | null = null;
let waitingRoomId: string | null = null;

function messages(streamId: string, atMs: number) {
  return Array.from({ length: MESSAGE_COUNT }, (_, i) => ({
    stream_id: streamId,
    user_id: ownerUserId,
    body: `E2E layout message ${i} — long enough to wrap on a narrow phone screen`,
    created_at: new Date(atMs).toISOString(),
  }));
}

// The list is the only thing that may scroll: it has to overflow, and it has to
// stay inside the viewport while doing so.
async function expectListIsTheScroller(page: Page) {
  const box = await page.getByTestId("chat-messages").evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    bottom: el.getBoundingClientRect().bottom,
  }));
  expect(box.scrollHeight).toBeGreaterThan(box.clientHeight + 100);
  expect(box.clientHeight).toBeGreaterThan(0);
  expect(box.bottom).toBeLessThanOrEqual(NARROW.height + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  ownerSlug = owner!.slug;
  ownerUserId = owner!.owner_user_id!;

  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  hasActiveRow = (count ?? 0) > 0;

  // Every message lands on the VOD's first frame, so the whole log is visible
  // without the fake mp4 ever playing.
  const vodStart = stamp - 7_200_000;
  const { data: ended } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "ended",
      started_at: new Date(vodStart).toISOString(),
      live_at: new Date(vodStart).toISOString(),
      ended_at: new Date(vodStart + 120_000).toISOString(),
      title: `E2E layout VOD ${stamp}`,
    })
    .select("id")
    .single();
  vodStreamId = ended!.id;
  await admin.from("chat_messages").insert(messages(vodStreamId, vodStart));

  const { data: video } = await admin
    .from("videos")
    .insert({
      channel_id: ownerChannelId,
      status: "ready",
      title: `E2E layout VOD ${stamp}`,
      mp4_path: `vod/e2e-${stamp}/layout.mp4`,
      source_stream_id: vodStreamId,
      published_at: new Date(vodStart + 120_000).toISOString(),
    })
    .select("id")
    .single();
  vodVideoId = video!.id;

  if (hasActiveRow) return;

  const { data: scheduled } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "scheduled",
      scheduled_start_at: new Date(stamp + 1_800_000).toISOString(),
      waiting_room_chat: true,
      title: `E2E layout waiting room ${stamp}`,
    })
    .select("id")
    .single();
  waitingRoomId = scheduled!.id;
  const { error: chatError } = await admin
    .from("chat_messages")
    .insert(messages(waitingRoomId, stamp));
  if (chatError) throw chatError;
});

test.afterAll(async () => {
  if (vodVideoId) await admin.from("videos").delete().eq("id", vodVideoId);
  if (vodStreamId) await admin.from("streams").delete().eq("id", vodStreamId);
  if (waitingRoomId) await admin.from("streams").delete().eq("id", waitingRoomId);
});

test("a long replay scrolls inside its own panel on a phone", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(NARROW);
  await page.goto(`/watch/${vodVideoId}`);

  await expect(page.getByText("Chat replay", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("chat-messages")).toBeVisible();

  await expectListIsTheScroller(page);
  await expectNoHorizontalOverflow(page);
});

test("a long chat scrolls inside its own panel on a phone", async ({ page }) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(120_000);
  await page.setViewportSize(NARROW);

  // Waiting-room chat is readable only to signed-in viewers, so the log is
  // empty for a visitor and there would be nothing to overflow.
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");

  await page.goto(`/${ownerSlug}/live`);

  await expect(page.getByText("Live chat", { exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("E2E layout message 199").first()).toBeVisible({
    timeout: 20_000,
  });

  await expectListIsTheScroller(page);
  await expectNoHorizontalOverflow(page);

  // The composer is pinned outside the scrolling list, so it is reachable
  // without scrolling the page.
  const composer = page
    .getByPlaceholder("Send a message")
    .or(page.getByText("Sign in to chat"));
  await expect(composer.first()).toBeInViewport();
});

test("the page never grows sideways at any width", async ({ page }) => {
  test.setTimeout(120_000);
  for (const size of [
    { width: 375, height: 720 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/watch/${vodVideoId}`);
    await expect(page.getByText("Chat replay", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expectNoHorizontalOverflow(page);
  }
});

test("scrolling up parks the list and the pill brings it back", async ({
  page,
}) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(120_000);
  await page.setViewportSize(NARROW);
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");

  await page.goto(`/${ownerSlug}/live`);
  const list = page.getByTestId("chat-messages");
  await expect(page.getByText("E2E layout message 199").first()).toBeVisible({
    timeout: 20_000,
  });

  await list.evaluate((el) => el.scrollTo({ top: 0 }));
  await expect
    .poll(async () => list.evaluate((el) => el.scrollTop))
    .toBeLessThan(50);

  await admin.from("chat_messages").insert({
    stream_id: waitingRoomId!,
    user_id: ownerUserId,
    body: `E2E layout latecomer ${stamp}`,
  });

  const pill = page.getByRole("button", { name: "New messages" });
  await expect(pill).toBeVisible({ timeout: 20_000 });
  const parked = await list.evaluate((el) => el.scrollTop);
  expect(parked).toBeLessThan(50);

  await pill.click();
  await expect
    .poll(async () =>
      list.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)
    )
    .toBeLessThan(50);
  await expect(pill).toHaveCount(0);
});

test("the chat column ends level with the player at desktop width", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/watch/${vodVideoId}`);

  await expect(page.getByText("Chat replay", { exact: true })).toBeVisible({
    timeout: 20_000,
  });

  const player = await page.getByRole("region", { name: "Video player" }).boundingBox();
  const chat = await page
    .getByTestId("chat-messages")
    .evaluate((el) => el.closest(".rounded-lg")!.getBoundingClientRect().bottom);

  expect(Math.abs(chat - (player!.y + player!.height))).toBeLessThanOrEqual(2);
});

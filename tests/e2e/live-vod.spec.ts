import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stamp = Date.now();
const liveSlug = `e2e-live-${stamp}`;
const offlineSlug = `e2e-offline-${stamp}`;

let ownerUserId: string;
let liveChannelId: string;
let offlineChannelId: string;
let portraitVideoId: string;
let replayVideoId: string;
let noReplayVideoId: string;

test.beforeAll(async () => {
  const { data: owner, error } = await admin
    .from("channels")
    .select("owner_user_id")
    .eq("slug", "owner")
    .single();
  if (error || !owner) throw error ?? new Error("owner channel missing");
  ownerUserId = owner.owner_user_id;

  const { data: live } = await admin
    .from("channels")
    .insert({ owner_user_id: ownerUserId, slug: liveSlug, name: "E2E Live" })
    .select("id")
    .single();
  liveChannelId = live!.id;

  const { data: offline } = await admin
    .from("channels")
    .insert({ owner_user_id: ownerUserId, slug: offlineSlug, name: "E2E Offline" })
    .select("id")
    .single();
  offlineChannelId = offline!.id;

  const nowIso = new Date(stamp).toISOString();

  await admin.from("streams").insert({
    channel_id: liveChannelId,
    status: "live",
    hls_path: "https://example.com/owner/index.m3u8",
    started_at: nowIso,
    last_seen_at: nowIso,
  });

  const base = stamp - 3_600_000;
  const { data: endedStream } = await admin
    .from("streams")
    .insert({
      channel_id: offlineChannelId,
      status: "ended",
      started_at: new Date(base).toISOString(),
      ended_at: nowIso,
    })
    .select("id")
    .single();
  const sourceStreamId = endedStream!.id;

  await admin.from("chat_messages").insert([
    {
      stream_id: sourceStreamId,
      user_id: ownerUserId,
      body: "E2E replay hello",
      created_at: new Date(base + 1_000).toISOString(),
    },
    {
      stream_id: sourceStreamId,
      user_id: ownerUserId,
      body: "E2E replay later",
      created_at: new Date(base + 5_000).toISOString(),
    },
  ]);

  const { data: portrait } = await admin
    .from("videos")
    .insert({
      channel_id: offlineChannelId,
      status: "ready",
      title: "E2E Portrait VOD",
      mp4_path: `vod/${offlineSlug}/portrait.mp4`,
      width: 720,
      height: 1280,
      published_at: nowIso,
    })
    .select("id")
    .single();
  portraitVideoId = portrait!.id;

  const { data: replay } = await admin
    .from("videos")
    .insert({
      channel_id: offlineChannelId,
      status: "ready",
      title: "E2E Replay VOD",
      mp4_path: `vod/${offlineSlug}/replay.mp4`,
      source_stream_id: sourceStreamId,
      published_at: nowIso,
    })
    .select("id")
    .single();
  replayVideoId = replay!.id;

  const { data: noReplay } = await admin
    .from("videos")
    .insert({
      channel_id: offlineChannelId,
      status: "ready",
      title: "E2E No Replay VOD",
      mp4_path: `vod/${offlineSlug}/noreplay.mp4`,
      published_at: nowIso,
    })
    .select("id")
    .single();
  noReplayVideoId = noReplay!.id;
});

test.afterAll(async () => {
  await admin.from("channels").delete().eq("id", liveChannelId);
  await admin.from("channels").delete().eq("id", offlineChannelId);
});

test("offline channel shows the scheduled placeholder and no chat", async ({
  page,
}) => {
  await page.goto(`/${offlineSlug}`);
  await expect(page.getByText("No stream scheduled right now")).toBeVisible();
  await expect(page.getByText("Live chat")).toHaveCount(0);
});

test("live channel shows the live chat panel", async ({ page }) => {
  await admin
    .from("streams")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("channel_id", liveChannelId)
    .eq("status", "live");
  await page.goto(`/${liveSlug}`);
  await expect(page.getByText("Live chat")).toBeVisible();
  await expect(page.getByText("No stream scheduled right now")).toHaveCount(0);
});

test("portrait VOD renders in a vertical container", async ({ page }) => {
  await page.goto(`/watch/${portraitVideoId}`);
  await expect(
    page.getByRole("region", { name: "Video player" })
  ).toHaveClass(/aspect-\[9\/16\]/);
});

test("VOD with source-stream chat shows the replay panel", async ({ page }) => {
  await page.goto(`/watch/${replayVideoId}`);
  await expect(page.getByText("Chat replay", { exact: true })).toBeVisible();
});

test("VOD without source chat shows no replay panel", async ({ page }) => {
  await page.goto(`/watch/${noReplayVideoId}`);
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("Chat replay", { exact: true })).toHaveCount(0);
});

test("a new broadcast after a prior session creates a fresh stream with empty chat", async ({
  request,
}) => {
  const slug = `e2e-session-${stamp}`;
  const { data: ch } = await admin
    .from("channels")
    .insert({ owner_user_id: ownerUserId, slug, name: "E2E Session" })
    .select("id")
    .single();

  const base = stamp - 7_200_000;
  const { data: ended } = await admin
    .from("streams")
    .insert({
      channel_id: ch!.id,
      status: "ended",
      started_at: new Date(base).toISOString(),
      ended_at: new Date(base + 60_000).toISOString(),
    })
    .select("id")
    .single();
  await admin.from("chat_messages").insert({
    stream_id: ended!.id,
    user_id: ownerUserId,
    body: "previous session message",
  });

  try {
    const res = await request.post(`/api/ingest/live?path=${slug}`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: streams } = await admin
      .from("streams")
      .select("id, status")
      .eq("channel_id", ch!.id)
      .order("created_at", { ascending: false });
    const live = streams!.find((s) => s.status === "live");
    expect(live, "a new live stream row exists").toBeTruthy();
    expect(live!.id, "the new session is not the prior row").not.toBe(ended!.id);

    const { count } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", live!.id);
    expect(count, "the new session's chat is empty").toBe(0);
  } finally {
    await admin.from("channels").delete().eq("id", ch!.id);
  }
});

test("a reconnect within the staleness window keeps the same stream id", async ({
  request,
}) => {
  const slug = `e2e-reconnect-${stamp}`;
  const { data: ch } = await admin
    .from("channels")
    .insert({ owner_user_id: ownerUserId, slug, name: "E2E Reconnect" })
    .select("id")
    .single();

  const nowIso = new Date().toISOString();
  const { data: liveRow } = await admin
    .from("streams")
    .insert({
      channel_id: ch!.id,
      status: "live",
      hls_path: "https://example.com/reconnect/index.m3u8",
      started_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("id")
    .single();

  try {
    const res = await request.post(`/api/ingest/live?path=${slug}`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: streams } = await admin
      .from("streams")
      .select("id, status")
      .eq("channel_id", ch!.id);
    expect(streams, "no extra stream row was created").toHaveLength(1);
    expect(streams![0].id, "the ongoing session is reused").toBe(liveRow!.id);
    expect(streams![0].status).toBe("live");
  } finally {
    await admin.from("channels").delete().eq("id", ch!.id);
  }
});

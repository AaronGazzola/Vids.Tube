import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const stamp = Date.now();

let ownerChannelId: string;
let ownerUserId: string;
let ownerSlug: string;
let sourceStreamId: string;
let portraitVideoId: string;
let replayVideoId: string;
let noReplayVideoId: string;

test.beforeAll(async () => {
  const { data: owner, error } = await admin
    .from("channels")
    .select("id, owner_user_id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !owner) throw error ?? new Error("owner channel missing");
  ownerChannelId = owner.id;
  ownerUserId = owner.owner_user_id;
  ownerSlug = owner.slug;

  const nowIso = new Date(stamp).toISOString();
  const base = stamp - 3_600_000;

  const { data: endedStream } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "ended",
      started_at: new Date(base).toISOString(),
      ended_at: nowIso,
    })
    .select("id")
    .single();
  sourceStreamId = endedStream!.id;

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
      channel_id: ownerChannelId,
      status: "ready",
      title: "E2E Portrait VOD",
      mp4_path: `vod/e2e-${stamp}/portrait.mp4`,
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
      channel_id: ownerChannelId,
      status: "ready",
      title: "E2E Replay VOD",
      mp4_path: `vod/e2e-${stamp}/replay.mp4`,
      source_stream_id: sourceStreamId,
      published_at: nowIso,
    })
    .select("id")
    .single();
  replayVideoId = replay!.id;

  const { data: noReplay } = await admin
    .from("videos")
    .insert({
      channel_id: ownerChannelId,
      status: "ready",
      title: "E2E No Replay VOD",
      mp4_path: `vod/e2e-${stamp}/noreplay.mp4`,
      published_at: nowIso,
    })
    .select("id")
    .single();
  noReplayVideoId = noReplay!.id;
});

test.afterAll(async () => {
  await admin.from("videos").delete().eq("id", portraitVideoId);
  await admin.from("videos").delete().eq("id", replayVideoId);
  await admin.from("videos").delete().eq("id", noReplayVideoId);
  await admin.from("streams").delete().eq("id", sourceStreamId);
});

// Owner-gated rework (AZ-48): only the platform owner's channel is viewable, so
// these drive and assert the seeded owner channel directly (guarded so a real
// in-progress broadcast is never disturbed; the brief live row is cleaned up).
async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .eq("status", "live");
  return (count ?? 0) > 0;
}

test("the owner channel shows the scheduled placeholder when offline", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");
  await page.goto(`/${ownerSlug}`);
  await expect(page.getByText("No stream scheduled right now")).toBeVisible();
  await expect(page.getByText("Live chat", { exact: true })).toHaveCount(0);
});

test("the owner channel shows the live chat panel when live", async ({
  page,
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const res = await request.post(`/api/ingest/live`, {
    headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
  });
  expect(res.ok()).toBeTruthy();
  const { data: liveRow } = await admin
    .from("streams")
    .select("id")
    .eq("channel_id", ownerChannelId)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    await page.goto(`/${ownerSlug}`);
    await expect(page.getByText("Live chat", { exact: true })).toBeVisible();
    await expect(
      page.getByText("No stream scheduled right now")
    ).toHaveCount(0);
  } finally {
    if (liveRow) {
      await admin.from("streams").delete().eq("id", liveRow.id);
    }
  }
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

test("the replay panel can be collapsed and re-expanded", async ({ page }) => {
  await page.goto(`/watch/${replayVideoId}`);

  const collapse = page.getByRole("button", { name: "Collapse chat replay" });
  const expand = page.getByRole("button", { name: "Show chat replay" });
  const listPlaceholder = page.getByText(
    "Chat replay will appear as the video plays."
  );

  await expect(collapse).toBeVisible();
  await expect(listPlaceholder).toBeVisible();

  await collapse.click();
  await expect(expand).toBeVisible();
  await expect(collapse).toHaveCount(0);
  await expect(listPlaceholder).toHaveCount(0);

  await expand.click();
  await expect(collapse).toBeVisible();
  await expect(listPlaceholder).toBeVisible();
});

test("VOD without source chat shows no replay panel", async ({ page }) => {
  await page.goto(`/watch/${noReplayVideoId}`);
  await expect(page.locator("video")).toBeVisible();
  await expect(page.getByText("Chat replay", { exact: true })).toHaveCount(0);
});

// Owner-gated rework (AZ-48): the ingest hook hardcodes the owner channel, so this
// drives the seeded owner channel directly. Guarded against a real broadcast; the
// prior-session rows and the new live row are cleaned up. (decideGoLive's pure
// logic is also unit-covered in tests/unit/stream-session.test.ts.)
test("a new broadcast after a prior session creates a fresh stream with empty chat", async ({
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const base = stamp - 7_200_000;
  const { data: ended } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
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

  let newLiveId: string | null = null;
  try {
    const res = await request.post(`/api/ingest/live`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: streams } = await admin
      .from("streams")
      .select("id, status")
      .eq("channel_id", ownerChannelId)
      .eq("status", "live")
      .order("created_at", { ascending: false });
    const live = streams![0];
    expect(live, "a new live stream row exists").toBeTruthy();
    expect(live.id, "the new session is not the prior ended row").not.toBe(
      ended!.id
    );
    newLiveId = live.id;

    const { count } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", live.id);
    expect(count, "the new session's chat is empty").toBe(0);
  } finally {
    if (newLiveId) await admin.from("streams").delete().eq("id", newLiveId);
    await admin.from("chat_messages").delete().eq("stream_id", ended!.id);
    await admin.from("streams").delete().eq("id", ended!.id);
  }
});

test("two sequential broadcasts each replay only their own chat, spread across the timeline", async ({
  page,
}) => {
  const mk = async (label: string, startMs: number) => {
    const { data: stream } = await admin
      .from("streams")
      .insert({
        channel_id: ownerChannelId,
        status: "ended",
        started_at: new Date(startMs).toISOString(),
        ended_at: new Date(startMs + 120_000).toISOString(),
      })
      .select("id")
      .single();
    await admin.from("chat_messages").insert([
      {
        stream_id: stream!.id,
        user_id: ownerUserId,
        body: `${label}-early`,
        created_at: new Date(startMs).toISOString(),
      },
      {
        stream_id: stream!.id,
        user_id: ownerUserId,
        body: `${label}-late`,
        created_at: new Date(startMs + 60_000).toISOString(),
      },
    ]);
    const { data: video } = await admin
      .from("videos")
      .insert({
        channel_id: ownerChannelId,
        status: "ready",
        title: `E2E ${label} VOD`,
        mp4_path: `vod/e2e-${stamp}/${label}.mp4`,
        source_stream_id: stream!.id,
        published_at: new Date(startMs + 120_000).toISOString(),
      })
      .select("id")
      .single();
    return { streamId: stream!.id, videoId: video!.id };
  };

  const first = await mk("alpha", stamp - 10_800_000);
  const second = await mk("bravo", stamp - 9_000_000);

  try {
    await page.goto(`/watch/${first.videoId}`);
    await expect(page.getByText("Chat replay", { exact: true })).toBeVisible();
    await expect(page.getByText("alpha-early")).toBeVisible();
    await expect(page.getByText("alpha-late")).toHaveCount(0);
    await expect(page.getByText("bravo-early")).toHaveCount(0);
    await expect(page.getByText("bravo-late")).toHaveCount(0);

    await page.goto(`/watch/${second.videoId}`);
    await expect(page.getByText("Chat replay", { exact: true })).toBeVisible();
    await expect(page.getByText("bravo-early")).toBeVisible();
    await expect(page.getByText("bravo-late")).toHaveCount(0);
    await expect(page.getByText("alpha-early")).toHaveCount(0);
    await expect(page.getByText("alpha-late")).toHaveCount(0);
  } finally {
    await admin.from("videos").delete().eq("id", first.videoId);
    await admin.from("videos").delete().eq("id", second.videoId);
    await admin.from("streams").delete().eq("id", first.streamId);
    await admin.from("streams").delete().eq("id", second.streamId);
  }
});

// Owner-gated rework (AZ-48): drive the seeded owner channel. Guarded so it only
// runs when the owner is offline, then seeds a single fresh live row; the reconnect
// must reuse that row (no new row, started_at unchanged) rather than start a session.
test("a reconnect within the staleness window keeps the same stream id", async ({
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const nowIso = new Date().toISOString();
  const { data: liveRow } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/reconnect/index.m3u8",
      started_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("id, started_at")
    .single();

  const createdIds = new Set<string>([liveRow!.id]);
  try {
    const res = await request.post(`/api/ingest/live`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: live } = await admin
      .from("streams")
      .select("id, status, started_at")
      .eq("channel_id", ownerChannelId)
      .eq("status", "live");
    live!.forEach((s) => createdIds.add(s.id));
    expect(live, "no extra live row was created — the session is reused").toHaveLength(1);
    expect(live![0].id, "the ongoing session is reused").toBe(liveRow!.id);
    expect(
      live![0].started_at,
      "started_at is not reset on reconnect"
    ).toBe(liveRow!.started_at);
  } finally {
    for (const id of createdIds) {
      await admin.from("streams").delete().eq("id", id);
    }
  }
});

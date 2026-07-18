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

test("the offline channel home shows no live feature card", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");
  await page.goto(`/${ownerSlug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("LIVE", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Watch the live stream")).toHaveCount(0);
  await expect(page.getByText("Live chat", { exact: true })).toHaveCount(0);
});

test("a connected encoder stays private (preview) until go-live", async ({
  page,
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const res = await request.post(`/api/ingest/live`, {
    headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
  });
  expect(res.ok()).toBeTruthy();

  const { data: session } = await admin
    .from("streams")
    .select("id, status")
    .eq("channel_id", ownerChannelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    expect(session?.status, "encoder connect lands in preview").toBe("preview");
    await page.goto(`/${ownerSlug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("LIVE", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Watch the live stream")).toHaveCount(0);
  } finally {
    if (session) await admin.from("streams").delete().eq("id", session.id);
  }
});

test("a live broadcast features on the channel home and plays with chat at /live", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E Live ${stamp}`,
      description: `E2E live description ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  try {
    await page.goto(`/${ownerSlug}`);
    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
    await expect(page.getByText(`E2E Live ${stamp}`)).toBeVisible();
    await expect(page.getByText("Watch the live stream")).toBeVisible();

    await page.goto(`/${ownerSlug}/live`);
    await expect(
      page.getByRole("heading", { name: `E2E Live ${stamp}` })
    ).toBeVisible();
    await expect(
      page.getByText(`E2E live description ${stamp}`)
    ).toBeVisible();
    await expect(page.getByText("Live chat", { exact: true })).toBeVisible();
  } finally {
    await admin.from("streams").delete().eq("id", live!.id);
  }
});

test("an encoder drop while live opens a reconnect gap and keeps the broadcast live", async ({
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E Inherit ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  try {
    const res = await request.post(`/api/ingest/offline`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: stream } = await admin
      .from("streams")
      .select("status")
      .eq("id", live!.id)
      .single();
    expect(
      stream?.status,
      "the stream stays live across an encoder drop"
    ).toBe("live");

    const { data: gap } = await admin
      .from("stream_gaps")
      .select("id, gap_end_at")
      .eq("stream_id", live!.id)
      .is("gap_end_at", null)
      .maybeSingle();
    expect(gap, "the drop opens a reconnect gap").toBeTruthy();
  } finally {
    await admin.from("stream_gaps").delete().eq("stream_id", live!.id);
    await admin.from("videos").delete().eq("source_stream_id", live!.id);
    await admin.from("streams").delete().eq("id", live!.id);
  }
});

test("an ad-hoc preview session is deleted on disconnect and creates no VOD", async ({
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const nowIso = new Date().toISOString();
  const { data: preview } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "preview",
      created_in_ui: false,
      hls_path: "https://example.com/preview/index.m3u8",
      started_at: nowIso,
      last_seen_at: nowIso,
    })
    .select("id")
    .single();

  try {
    const res = await request.post(`/api/ingest/offline`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { count: left } = await admin
      .from("streams")
      .select("*", { count: "exact", head: true })
      .eq("id", preview!.id);
    expect(left, "the ad-hoc preview row is deleted on disconnect").toBe(0);

    const { count } = await admin
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("source_stream_id", preview!.id);
    expect(count, "no VOD is created for a preview-only session").toBe(0);
  } finally {
    await admin.from("videos").delete().eq("source_stream_id", preview!.id);
    await admin.from("streams").delete().eq("id", preview!.id);
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

  let newSessionId: string | null = null;
  try {
    const res = await request.post(`/api/ingest/live`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: streams } = await admin
      .from("streams")
      .select("id, status")
      .eq("channel_id", ownerChannelId)
      .eq("status", "preview")
      .order("created_at", { ascending: false });
    const session = streams![0];
    expect(session, "a new preview stream row exists").toBeTruthy();
    expect(
      session.id,
      "the new session is not the prior ended row"
    ).not.toBe(ended!.id);
    newSessionId = session.id;

    const { count } = await admin
      .from("chat_messages")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", session.id);
    expect(count, "the new session's chat is empty").toBe(0);
  } finally {
    if (newSessionId) await admin.from("streams").delete().eq("id", newSessionId);
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

// Scheduled broadcasts (AZ-28): create-ahead → coming-soon card → encoder claims
// the nearest upcoming scheduled row into preview (metadata intact); a missed row
// (past the claim grace window) is not claimed. decideGoLive's pure claim logic is
// also unit-covered in tests/unit/stream-session.test.ts.
test("an upcoming scheduled broadcast shows a coming-soon countdown card", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { data: scheduled } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "scheduled",
      title: `E2E Scheduled ${stamp}`,
      scheduled_start_at: startAt,
    })
    .select("id")
    .single();

  try {
    await page.goto(`/${ownerSlug}`);
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
    await expect(page.getByText(`E2E Scheduled ${stamp}`)).toBeVisible();

    await page.goto(`/${ownerSlug}/live`);
    await expect(page.getByText("Coming soon")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `E2E Scheduled ${stamp}` })
    ).toBeVisible();
  } finally {
    await admin.from("streams").delete().eq("id", scheduled!.id);
  }
});

test("a connecting encoder claims the nearest upcoming scheduled broadcast", async ({
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const thumb = `live-thumb/${ownerChannelId}/e2e-sched-${stamp}.jpg`;
  const { data: scheduled } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "scheduled",
      title: `E2E Claim ${stamp}`,
      description: `E2E claim description ${stamp}`,
      thumbnail_path: thumb,
      scheduled_start_at: startAt,
    })
    .select("id")
    .single();

  const createdIds = new Set<string>([scheduled!.id]);
  try {
    const res = await request.post(`/api/ingest/live`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: claimed } = await admin
      .from("streams")
      .select("id, status, hls_path, title, description, thumbnail_path")
      .eq("id", scheduled!.id)
      .single();
    expect(claimed!.status, "the scheduled row is claimed into preview").toBe(
      "preview"
    );
    expect(claimed!.hls_path, "hls_path is set on claim").toBeTruthy();
    expect(claimed!.title).toBe(`E2E Claim ${stamp}`);
    expect(claimed!.description).toBe(`E2E claim description ${stamp}`);
    expect(claimed!.thumbnail_path, "thumbnail preserved on claim").toBe(thumb);

    const { data: previews } = await admin
      .from("streams")
      .select("id")
      .eq("channel_id", ownerChannelId)
      .eq("status", "preview");
    previews!.forEach((s) => createdIds.add(s.id));
    expect(
      previews,
      "claim reuses the scheduled row rather than inserting a new one"
    ).toHaveLength(1);
  } finally {
    for (const id of createdIds) {
      await admin.from("streams").delete().eq("id", id);
    }
  }
});

test("a past-dated scheduled broadcast is still the active row and is claimed on connect", async ({
  request,
}) => {
  test.skip(await ownerIsLive(), "owner channel is currently live");

  const startAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: missed } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "scheduled",
      title: `E2E Missed ${stamp}`,
      scheduled_start_at: startAt,
    })
    .select("id")
    .single();

  try {
    const res = await request.post(`/api/ingest/live`, {
      headers: { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! },
    });
    expect(res.ok()).toBeTruthy();

    const { data: claimed } = await admin
      .from("streams")
      .select("status, title")
      .eq("id", missed!.id)
      .single();
    expect(
      claimed!.status,
      "the single active row is claimed into preview even when its date passed"
    ).toBe("preview");
    expect(claimed!.title, "claiming keeps the broadcast settings").toBe(
      `E2E Missed ${stamp}`
    );

    const { count: activeCount } = await admin
      .from("streams")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", ownerChannelId)
      .in("status", ["draft", "scheduled", "preview", "live"]);
    expect(activeCount, "no second active row is created").toBe(1);
  } finally {
    await admin.from("streams").delete().eq("id", missed!.id);
  }
});

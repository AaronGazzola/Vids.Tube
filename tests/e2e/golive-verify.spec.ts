import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const INGEST = { "x-ingest-secret": process.env.INGEST_SHARED_SECRET! };
const stamp = Date.now();

let ownerChannelId: string;
let ownerUserId: string;
let ownerSlug: string;
let hasActiveRow = false;

test.describe.configure({ mode: "serial" });

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

  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  hasActiveRow = (count ?? 0) > 0;
});

async function loginAsOwner(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");
}

function authedClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

test("waiting-room chat RLS matrix gates posting by stream state", async () => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(90_000);

  const authed = authedClient();
  const { error: signInError } = await authed.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
  });
  expect(signInError).toBeNull();

  const dated = new Date(stamp + 3_600_000).toISOString();
  const nowIso = new Date().toISOString();
  const staleIso = new Date(stamp - 300_000).toISOString();

  const cases: {
    name: string;
    row: Record<string, unknown>;
    allowed: boolean;
  }[] = [
    {
      name: "dated scheduled with waiting-room chat on",
      row: {
        status: "scheduled",
        scheduled_start_at: dated,
        waiting_room_chat: true,
      },
      allowed: true,
    },
    {
      name: "dated scheduled with waiting-room chat off",
      row: {
        status: "scheduled",
        scheduled_start_at: dated,
        waiting_room_chat: false,
      },
      allowed: false,
    },
    {
      name: "undated scheduled with waiting-room chat on",
      row: { status: "scheduled", waiting_room_chat: true },
      allowed: false,
    },
    {
      name: "draft with waiting-room chat on",
      row: { status: "draft", waiting_room_chat: true, created_in_ui: true },
      allowed: false,
    },
    {
      name: "fresh live stream",
      row: { status: "live", started_at: nowIso, last_seen_at: nowIso },
      allowed: true,
    },
    {
      name: "stale live stream (disconnected keeps chat open)",
      row: { status: "live", started_at: staleIso, last_seen_at: staleIso },
      allowed: true,
    },
  ];

  for (const c of cases) {
    const { data: created, error: createError } = await admin
      .from("streams")
      .insert({ channel_id: ownerChannelId, ...c.row })
      .select("id")
      .single();
    expect(createError, `${c.name}: stream created`).toBeNull();
    const sid = created!.id;

    try {
      const { error: postError } = await authed.from("chat_messages").insert({
        stream_id: sid,
        user_id: ownerUserId,
        body: `E2E waiting-room matrix: ${c.name}`,
      });
      if (c.allowed) {
        expect(postError, `${c.name}: post allowed`).toBeNull();
      } else {
        expect(postError, `${c.name}: post rejected by RLS`).not.toBeNull();
      }
    } finally {
      await admin.from("streams").delete().eq("id", sid);
    }
  }

  await authed.auth.signOut();
});

test("waiting page shows countdown, count, and chat, then swaps to the player at go-live", async ({
  page,
}) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(120_000);

  const { data: scheduled } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "scheduled",
      scheduled_start_at: new Date(stamp + 1_800_000).toISOString(),
      waiting_room_chat: true,
      title: `E2E waiting room ${stamp}`,
    })
    .select("id")
    .single();
  const sid = scheduled!.id;

  try {
    await loginAsOwner(page);
    await page.goto(`/${ownerSlug}/live`);

    await expect(
      page.getByRole("heading", { name: `E2E waiting room ${stamp}` })
    ).toBeVisible();
    await expect(page.getByText(/person waiting|people waiting/)).toBeVisible();
    await expect(page.getByText("Live chat", { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Chat is offline")).toHaveCount(0);

    const authed = authedClient();
    await authed.auth.signInWithPassword({
      email: process.env.ADMIN_EMAIL!,
      password: process.env.ADMIN_PASSWORD!,
    });
    const { error: postError } = await authed.from("chat_messages").insert({
      stream_id: sid,
      user_id: ownerUserId,
      body: `E2E waiting hello ${stamp}`,
    });
    expect(postError, "posting to the waiting room succeeds").toBeNull();
    await expect(page.getByText(`E2E waiting hello ${stamp}`)).toBeVisible({
      timeout: 20_000,
    });
    await authed.auth.signOut();

    const nowIso = new Date().toISOString();
    await admin
      .from("streams")
      .update({
        status: "live",
        hls_path: "https://example.com/live/index.m3u8",
        started_at: nowIso,
        last_seen_at: nowIso,
        live_at: nowIso,
      })
      .eq("id", sid);

    await expect(page.locator("video"), "player appears at go-live").toBeVisible(
      { timeout: 30_000 }
    );
    await expect(
      page.getByText("Live chat", { exact: true }),
      "chat panel survives the swap"
    ).toBeVisible();
    await expect(
      page.getByText(`E2E waiting hello ${stamp}`),
      "waiting-room history carries into the live chat"
    ).toBeVisible();
  } finally {
    await admin.from("streams").delete().eq("id", sid);
  }
});

test("encoder hooks drive claim, revert, ad-hoc delete, gaps, and the unique index holds", async ({
  request,
}) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(120_000);

  const { data: draft } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "draft",
      created_in_ui: true,
      title: `E2E lifecycle ${stamp}`,
    })
    .select("id")
    .single();
  const draftId = draft!.id;

  try {
    const { error: dupError } = await admin
      .from("streams")
      .insert({ channel_id: ownerChannelId, status: "draft", created_in_ui: true })
      .select("id")
      .single();
    expect(dupError, "second active row rejected").not.toBeNull();
    expect(dupError!.code, "partial unique index fires").toBe("23505");

    const claim = await request.post("/api/ingest/live", { headers: INGEST });
    expect(claim.ok()).toBeTruthy();
    let { data: row } = await admin
      .from("streams")
      .select("status, hls_path, started_at")
      .eq("id", draftId)
      .single();
    expect(row?.status, "connect claims the UI draft into preview").toBe(
      "preview"
    );
    expect(row?.hls_path).toBeTruthy();
    expect(row?.started_at).toBeTruthy();

    const offline1 = await request.post("/api/ingest/offline", {
      headers: INGEST,
    });
    expect(offline1.ok()).toBeTruthy();
    ({ data: row } = await admin
      .from("streams")
      .select("status, hls_path, started_at")
      .eq("id", draftId)
      .single());
    expect(row?.status, "undated UI preview reverts to draft").toBe("draft");

    await admin
      .from("streams")
      .update({
        status: "scheduled",
        scheduled_start_at: new Date(stamp + 3_600_000).toISOString(),
      })
      .eq("id", draftId);
    const claim2 = await request.post("/api/ingest/live", { headers: INGEST });
    expect(claim2.ok()).toBeTruthy();
    const offline2 = await request.post("/api/ingest/offline", {
      headers: INGEST,
    });
    expect(offline2.ok()).toBeTruthy();
    ({ data: row } = await admin
      .from("streams")
      .select("status, hls_path, started_at")
      .eq("id", draftId)
      .single());
    expect(row?.status, "dated preview reverts to scheduled").toBe("scheduled");

    await admin.from("streams").delete().eq("id", draftId);

    const adhoc = await request.post("/api/ingest/live", { headers: INGEST });
    expect(adhoc.ok()).toBeTruthy();
    const { data: adhocRow } = await admin
      .from("streams")
      .select("id, status, created_in_ui")
      .eq("channel_id", ownerChannelId)
      .in("status", ["draft", "scheduled", "preview", "live"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(adhocRow?.status, "connect with no active row creates preview").toBe(
      "preview"
    );
    expect(adhocRow?.created_in_ui).toBe(false);

    const offline3 = await request.post("/api/ingest/offline", {
      headers: INGEST,
    });
    expect(offline3.ok()).toBeTruthy();
    const { count: adhocLeft } = await admin
      .from("streams")
      .select("*", { count: "exact", head: true })
      .eq("id", adhocRow!.id);
    expect(adhocLeft, "ad-hoc preview is deleted on disconnect").toBe(0);

    const nowIso = new Date().toISOString();
    const { data: live } = await admin
      .from("streams")
      .insert({
        channel_id: ownerChannelId,
        status: "live",
        hls_path: "https://example.com/live/index.m3u8",
        started_at: nowIso,
        last_seen_at: nowIso,
        live_at: nowIso,
      })
      .select("id")
      .single();
    const liveId = live!.id;

    try {
      const offline4 = await request.post("/api/ingest/offline", {
        headers: INGEST,
      });
      expect(offline4.ok()).toBeTruthy();
      const { data: liveRow } = await admin
        .from("streams")
        .select("status")
        .eq("id", liveId)
        .single();
      expect(liveRow?.status, "offline while live keeps the stream live").toBe(
        "live"
      );
      const { data: openGap } = await admin
        .from("stream_gaps")
        .select("id, gap_end_at")
        .eq("stream_id", liveId)
        .is("gap_end_at", null)
        .maybeSingle();
      expect(openGap, "disconnect opens a gap").toBeTruthy();

      const reconnect = await request.post("/api/ingest/live", {
        headers: INGEST,
      });
      expect(reconnect.ok()).toBeTruthy();
      const { data: closedGap } = await admin
        .from("stream_gaps")
        .select("gap_end_at")
        .eq("id", openGap!.id)
        .single();
      expect(closedGap?.gap_end_at, "reconnect closes the gap").toBeTruthy();
    } finally {
      await admin.from("stream_gaps").delete().eq("stream_id", liveId);
      await admin.from("streams").delete().eq("id", liveId);
    }
  } finally {
    await admin.from("streams").delete().eq("id", draftId);
  }
});

test("owner drives /live: draft, schedule, preview, go live, disconnect, end, discard", async ({
  page,
  request,
}) => {
  test.skip(hasActiveRow, "an active broadcast row exists");
  test.setTimeout(300_000);

  let streamId: string | null = null;

  try {
    await loginAsOwner(page);
    await page.goto("/live");

    await expect(page.getByText("No broadcast")).toBeVisible({
      timeout: 20_000,
    });
    const saveButton = page.getByRole("button", { name: "Save changes" });
    await expect(saveButton, "save disabled when unchanged").toBeDisabled();

    await page.fill("#title", `E2E drive ${stamp}`);
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const schedule = new Date(stamp + 3_600_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const localValue = `${schedule.getFullYear()}-${pad(schedule.getMonth() + 1)}-${pad(schedule.getDate())}T${pad(schedule.getHours())}:${pad(schedule.getMinutes())}`;
    await page.fill("#schedule", localValue);
    await saveButton.click();
    const scheduleDialog = page.getByRole("alertdialog");
    if (await scheduleDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await scheduleDialog.getByRole("button", { name: /save|schedule/i }).click();
    }
    await expect(page.getByText("Scheduled", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const { data: row } = await admin
      .from("streams")
      .select("id")
      .eq("channel_id", ownerChannelId)
      .in("status", ["draft", "scheduled", "preview", "live"])
      .maybeSingle();
    streamId = row!.id;

    const claim = await request.post("/api/ingest/live", { headers: INGEST });
    expect(claim.ok()).toBeTruthy();
    await expect(page.getByText("Preview", { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("tab", { name: "Preview" }).click();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Pop out the preview panel" }).click();
    const popup = await popupPromise;
    expect(popup.url()).toContain("panel=preview");
    await popup.close();

    await page.getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText("Go live now?")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Go live" })
      .click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible({
      timeout: 30_000,
    });

    const { data: liveRow } = await admin
      .from("streams")
      .select("live_at, title")
      .eq("id", streamId)
      .single();
    expect(liveRow?.live_at, "go-live sets live_at").toBeTruthy();

    const { data: vod } = await admin
      .from("videos")
      .select("id, status, title")
      .eq("source_stream_id", streamId)
      .maybeSingle();
    expect(vod, "go-live creates the processing VOD row").toBeTruthy();
    expect(vod?.status).toBe("processing");
    expect(vod?.title, "VOD inherits the stream title").toBe(
      `E2E drive ${stamp}`
    );

    const chatRows = Array.from({ length: 30 }, (_, i) => ({
      stream_id: streamId!,
      user_id: ownerUserId,
      body: `E2E activity filler ${i} ${stamp}`,
    }));
    await admin.from("chat_messages").insert(chatRows);

    await page.getByRole("tab", { name: "Activity" }).click();
    await expect(
      page.getByText(`E2E activity filler 29 ${stamp}`)
    ).toBeVisible({ timeout: 30_000 });
    const scrollState = await page.evaluate(() => {
      const doc = document.scrollingElement!;
      let chatScrolls = false;
      document.querySelectorAll("div").forEach((el) => {
        const style = getComputedStyle(el);
        if (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 10 &&
          el.textContent?.includes("E2E activity filler 0")
        ) {
          chatScrolls = true;
        }
      });
      return {
        pageOverflow: doc.scrollHeight - doc.clientHeight,
        chatScrolls,
      };
    });
    expect(
      scrollState.pageOverflow,
      "activity tab does not overflow the page"
    ).toBeLessThanOrEqual(1);
    expect(scrollState.chatScrolls, "chat panel itself scrolls").toBe(true);

    const offline = await request.post("/api/ingest/offline", {
      headers: INGEST,
    });
    expect(offline.ok()).toBeTruthy();
    await admin
      .from("streams")
      .update({ last_seen_at: new Date(stamp - 300_000).toISOString() })
      .eq("id", streamId);

    await expect(page.getByText("Live · disconnected")).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "End stream" }).click();
    await expect(page.getByText("End the broadcast?")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "End stream" })
      .click();
    await expect(page.getByText("No broadcast")).toBeVisible({
      timeout: 30_000,
    });

    const { data: endedRow } = await admin
      .from("streams")
      .select("status, ended_at")
      .eq("id", streamId)
      .single();
    expect(endedRow?.status, "end stream lands in ended").toBe("ended");
    expect(endedRow?.ended_at).toBeTruthy();
    const { data: gapAfterEnd } = await admin
      .from("stream_gaps")
      .select("id")
      .eq("stream_id", streamId)
      .is("gap_end_at", null)
      .maybeSingle();
    expect(gapAfterEnd, "ending closes any open gap").toBeNull();

    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.locator("#title")).toHaveValue("", { timeout: 30_000 });
    await page.fill("#title", `E2E discard ${stamp}`);
    await page.fill("#schedule", "");
    await saveButton.click();
    await expect(page.getByText("Draft", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByText("Discard this broadcast?")).toBeVisible();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Discard" })
      .click();
    await expect(page.getByText("No broadcast")).toBeVisible({
      timeout: 20_000,
    });
    const { count: discardLeft } = await admin
      .from("streams")
      .select("*", { count: "exact", head: true })
      .eq("channel_id", ownerChannelId)
      .eq("status", "draft");
    expect(discardLeft, "discard deletes the never-live draft").toBe(0);
  } finally {
    if (streamId) {
      await admin.from("videos").delete().eq("source_stream_id", streamId);
      await admin.from("stream_gaps").delete().eq("stream_id", streamId);
      await admin.from("chat_messages").delete().eq("stream_id", streamId);
      await admin.from("streams").delete().eq("id", streamId);
    }
    await admin
      .from("streams")
      .delete()
      .eq("channel_id", ownerChannelId)
      .in("status", ["draft", "scheduled", "preview"])
      .like("title", `E2E %${stamp}`);
  }
});

test("a VOD with one gap replays chat in sync across the jump", async ({
  page,
}) => {
  test.setTimeout(120_000);

  const { data: source } = await admin
    .from("videos")
    .select("mp4_path, width, height")
    .eq("channel_id", ownerChannelId)
    .eq("status", "ready")
    .not("mp4_path", "is", null)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  test.skip(!source, "no ready VOD with an mp4 to reuse");

  const t0 = stamp - 7_200_000;
  const iso = (offsetS: number) => new Date(t0 + offsetS * 1000).toISOString();

  const { data: endedStream } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "ended",
      started_at: iso(-10),
      live_at: iso(0),
      ended_at: iso(120),
    })
    .select("id")
    .single();
  const sid = endedStream!.id;

  try {
    await admin.from("stream_gaps").insert({
      stream_id: sid,
      gap_start_at: iso(30),
      gap_end_at: iso(60),
    });
    await admin.from("chat_messages").insert([
      { stream_id: sid, user_id: ownerUserId, body: `E2E gap before ${stamp}`, created_at: iso(2) },
      { stream_id: sid, user_id: ownerUserId, body: `E2E gap inside ${stamp}`, created_at: iso(45) },
      { stream_id: sid, user_id: ownerUserId, body: `E2E gap after ${stamp}`, created_at: iso(70) },
    ]);
    const { data: vod } = await admin
      .from("videos")
      .insert({
        channel_id: ownerChannelId,
        source_stream_id: sid,
        status: "ready",
        title: `E2E gap replay ${stamp}`,
        mp4_path: source!.mp4_path,
        width: source!.width,
        height: source!.height,
        published_at: iso(200),
      })
      .select("id")
      .single();

    await page.goto(`/watch/${vod!.id}`);
    await expect(page.getByText("Chat replay", { exact: true })).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.waitForFunction(() => {
      const v = document.querySelector("video");
      return v && v.readyState >= 1;
    });

    const seek = (t: number) =>
      page.evaluate((time) => {
        const v = document.querySelector("video")!;
        v.currentTime = time;
        v.dispatchEvent(new Event("timeupdate"));
      }, t);

    await seek(10);
    await expect(page.getByText(`E2E gap before ${stamp}`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(`E2E gap inside ${stamp}`)).toHaveCount(0);
    await expect(page.getByText(`E2E gap after ${stamp}`)).toHaveCount(0);

    await seek(33);
    await expect(
      page.getByText(`E2E gap inside ${stamp}`),
      "in-gap message clamps to the cut at 30s"
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`E2E gap after ${stamp}`)).toHaveCount(0);

    await seek(45);
    await expect(
      page.getByText(`E2E gap after ${stamp}`),
      "post-gap message shifts left by the gap duration (70s wall clock at 40s video time)"
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await admin.from("videos").delete().eq("source_stream_id", sid);
    await admin.from("stream_gaps").delete().eq("stream_id", sid);
    await admin.from("streams").delete().eq("id", sid);
  }
});

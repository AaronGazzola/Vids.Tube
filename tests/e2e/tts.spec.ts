import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Database } from "../../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let ownerChannelId: string;
let ownerSlug: string;
const stamp = Date.now();

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
});

async function ownerIsLive(): Promise<boolean> {
  const { count } = await admin
    .from("streams")
    .select("*", { count: "exact", head: true })
    .eq("channel_id", ownerChannelId)
    .in("status", ["draft", "scheduled", "preview", "live"]);
  return (count ?? 0) > 0;
}

test("the owner approves a suggested TTS request from the Activity panel", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E tts panel ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  const { data: chatMsg } = await admin
    .from("chat_messages")
    .insert({
      stream_id: live!.id,
      origin: "youtube",
      external_author_id: "UC_TTS_E2E",
      author_name: "TtsFan",
      body: `!tts E2E speak this ${stamp}`,
    })
    .select("id")
    .single();
  const { data: request } = await admin
    .from("tts_requests")
    .insert({
      channel_id: ownerChannelId,
      stream_id: live!.id,
      chat_message_id: chatMsg!.id,
      participant_key: "youtube:UC_TTS_E2E",
      origin: "youtube",
      author_name: "TtsFan",
      text: `E2E speak this ${stamp}`,
      status: "suggested",
      reason: "Friendly test message",
    })
    .select("id")
    .single();

  try {
    await page.goto("/login");
    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL!);
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/");

    await page.goto("/live");
    await page.getByRole("tab", { name: "Activity" }).click();
    const card = page
      .locator("li", { hasText: `!tts E2E speak this ${stamp}` })
      .first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText("Friendly test message")).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("tts_requests")
            .select("status")
            .eq("id", request!.id)
            .single();
          return data?.status;
        },
        { timeout: 15_000 }
      )
      .toBe("approved");
    await expect(card.getByText("approved")).toBeVisible({ timeout: 10_000 });
  } finally {
    await admin.from("tts_requests").delete().eq("stream_id", live!.id);
    await admin.from("chat_messages").delete().eq("stream_id", live!.id);
    await admin.from("streams").delete().eq("id", live!.id);
  }
});

test("the overlay plays an approved TTS request and marks it played", async ({
  page,
}) => {
  test.skip(await ownerIsLive(), "an active broadcast row exists");
  test.setTimeout(120_000);

  const tmp = mkdtempSync(join(tmpdir(), "tts-e2e-"));
  const mp3Path = join(tmp, "beep.mp3");
  const ffmpegArgs = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=600:duration=5",
    "-c:a",
    "libmp3lame",
    mp3Path,
  ];
  try {
    execFileSync(process.env.FFMPEG_BIN ?? "ffmpeg", ffmpegArgs);
  } catch {
    execFileSync("ffmpeg", ffmpegArgs);
  }

  const audioKey = `e2e-${stamp}.mp3`;
  const { error: uploadError } = await admin.storage
    .from("tts")
    .upload(audioKey, readFileSync(mp3Path), {
      contentType: "audio/mpeg",
      upsert: true,
    });
  expect(uploadError).toBeNull();
  rmSync(tmp, { recursive: true, force: true });

  const nowIso = new Date().toISOString();
  const { data: live } = await admin
    .from("streams")
    .insert({
      channel_id: ownerChannelId,
      status: "live",
      hls_path: "https://example.com/live/index.m3u8",
      title: `E2E tts overlay ${stamp}`,
      started_at: nowIso,
      last_seen_at: nowIso,
      live_at: nowIso,
    })
    .select("id")
    .single();

  const { data: request } = await admin
    .from("tts_requests")
    .insert({
      channel_id: ownerChannelId,
      stream_id: live!.id,
      participant_key: "youtube:UC_TTS_E2E",
      origin: "youtube",
      author_name: "TtsFan",
      text: `E2E overlay speech ${stamp}`,
      status: "approved",
      approved_at: nowIso,
      audio_path: audioKey,
    })
    .select("id")
    .single();

  try {
    await page.goto(`/overlay/${ownerSlug}`);
    await expect(page.getByText(`E2E overlay speech ${stamp}`)).toBeVisible({
      timeout: 30_000,
    });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("tts_requests")
            .select("status")
            .eq("id", request!.id)
            .single();
          return data?.status;
        },
        { message: "row flips to played after playback", timeout: 30_000 }
      )
      .toBe("played");

    await expect(page.getByText(`E2E overlay speech ${stamp}`)).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.getByText("Highlight", { exact: true })).toHaveCount(0);
    await expect(page.locator(".border-dashed")).toHaveCount(0);
  } finally {
    await admin.from("tts_requests").delete().eq("stream_id", live!.id);
    await admin.from("streams").delete().eq("id", live!.id);
    await admin.storage.from("tts").remove([audioKey]);
  }
});

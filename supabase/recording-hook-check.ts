import type { Database } from "@/supabase/types";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const ingestSecret = process.env.INGEST_SHARED_SECRET!;
const baseUrl = process.env.RECORDING_HOOK_BASE_URL ?? "http://localhost:3000";

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  }
}

async function withProcessingVideo<T>(
  channelId: string,
  fn: (videoId: string) => Promise<T>
): Promise<T> {
  const { data, error } = await admin
    .from("videos")
    .insert({
      channel_id: channelId,
      status: "processing",
      title: `recording-hook-check ${Date.now()}`,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("failed to insert processing video");
  }
  try {
    return await fn(data.id);
  } finally {
    await admin.from("videos").delete().eq("id", data.id);
  }
}

async function postHook(slug: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/ingest/recording?path=${slug}`, {
    method: "POST",
    headers: {
      "x-ingest-secret": ingestSecret,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function run() {
  const { data: channel } = await admin
    .from("channels")
    .select("id, slug")
    .limit(1)
    .maybeSingle();
  if (!channel) {
    console.log("SKIP: no channel present (run seed)");
    return;
  }

  await withProcessingVideo(channel.id, async (videoId) => {
    const previewKeys = [
      `vod/${channel.slug}/test-${videoId}/preview-1.jpg`,
      `vod/${channel.slug}/test-${videoId}/preview-2.jpg`,
    ];
    const res = await postHook(channel.slug, {
      mp4Path: `vod/${channel.slug}/${videoId}.mp4`,
      thumbnailPath: `vod/${channel.slug}/${videoId}.jpg`,
      durationS: 123,
      width: 1080,
      height: 1920,
      previewPaths: previewKeys,
    });
    assert("hook with full payload returns 2xx", res.ok);

    const { data: updated } = await admin
      .from("videos")
      .select(
        "status, mp4_path, thumbnail_path, duration_s, width, height, preview_paths, published_at"
      )
      .eq("id", videoId)
      .single();
    assert(
      "video promoted to ready with all new fields",
      updated?.status === "ready" &&
        updated?.width === 1080 &&
        updated?.height === 1920 &&
        Array.isArray(updated?.preview_paths) &&
        updated?.preview_paths.length === 2 &&
        updated?.preview_paths[0] === previewKeys[0] &&
        typeof updated?.published_at === "string"
    );
  });

  await withProcessingVideo(channel.id, async (videoId) => {
    const res = await postHook(channel.slug, {
      mp4Path: `vod/${channel.slug}/${videoId}.mp4`,
      thumbnailPath: `vod/${channel.slug}/${videoId}.jpg`,
      durationS: 60,
    });
    assert("hook without new fields still returns 2xx (legacy)", res.ok);

    const { data: updated } = await admin
      .from("videos")
      .select("status, width, height, preview_paths")
      .eq("id", videoId)
      .single();
    assert(
      "legacy payload publishes video with null dims and empty previews",
      updated?.status === "ready" &&
        updated?.width === null &&
        updated?.height === null &&
        Array.isArray(updated?.preview_paths) &&
        updated?.preview_paths.length === 0
    );
  });

  await withProcessingVideo(channel.id, async (videoId) => {
    const res = await postHook(channel.slug, {
      mp4Path: `vod/${channel.slug}/${videoId}.mp4`,
      previewPaths: "not-an-array" as unknown as string[],
    });
    assert("malformed previewPaths is rejected (400)", res.status === 400);

    const { data: still } = await admin
      .from("videos")
      .select("status")
      .eq("id", videoId)
      .single();
    assert(
      "rejected payload leaves the video processing",
      still?.status === "processing"
    );
  });

  const forged = await fetch(
    `${baseUrl}/api/ingest/recording?path=${channel.slug}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mp4Path: "vod/forged.mp4" }),
    }
  );
  assert("forged request (no secret) is rejected (403)", forged.status === 403);
}

run()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("recording hook check failed:", error);
    process.exit(1);
  });

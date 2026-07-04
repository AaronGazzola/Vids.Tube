import type { Database } from "@/supabase/types";
import { NextResponse } from "next/server";
import {
  hasValidIngestSecret,
  resolveIngestChannel,
  supabaseAdmin,
} from "../_shared";

type VideoUpdate = Database["public"]["Tables"]["videos"]["Update"];

type TargetVideo = { id: string; thumbnail_path: string | null };

type RecordingPayload = {
  mp4Path?: string;
  thumbnailPath?: string;
  durationS?: number;
  width?: number;
  height?: number;
  previewPaths?: string[];
  recordedAt?: string;
};

const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

// Find the processing VOD row this recording belongs to. Preferred path: match
// the stream session whose start time bounds the recording's start (`recordedAt`
// from the VM), then that stream's `source_stream_id` VOD — correct even with
// multiple channels or back-to-back sessions. Falls back to the newest
// processing row for the channel when `recordedAt` is absent (legacy VM) or no
// session matches.
async function findTargetVideo(
  channelId: string,
  recordedAt: string | null
): Promise<TargetVideo | null> {
  if (recordedAt && ISO_RE.test(recordedAt)) {
    const { data: stream, error: streamError } = await supabaseAdmin
      .from("streams")
      .select("id")
      .eq("channel_id", channelId)
      .lte("started_at", recordedAt)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (streamError) {
      console.error(streamError);
      throw new Error("Failed to resolve recording stream");
    }
    if (stream) {
      const { data: byStream, error: byStreamError } = await supabaseAdmin
        .from("videos")
        .select("id, thumbnail_path, mp4_path")
        .eq("source_stream_id", stream.id)
        .eq("status", "processing")
        .maybeSingle();
      if (byStreamError) {
        console.error(byStreamError);
        throw new Error("Failed to resolve recording VOD");
      }
      if (byStream) {
        return byStream.mp4_path
          ? null
          : { id: byStream.id, thumbnail_path: byStream.thumbnail_path };
      }
    }
    console.warn(
      `recording: no processing VOD for recordedAt ${recordedAt} on channel ${channelId}; falling back to newest processing`
    );
  }

  const { data: newest, error: newestError } = await supabaseAdmin
    .from("videos")
    .select("id, thumbnail_path")
    .eq("channel_id", channelId)
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newestError) {
    console.error(newestError);
    throw new Error("Failed to resolve recording VOD");
  }
  return newest ?? null;
}

function sanitizePreviewPaths(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cleaned: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      return null;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0) {
      continue;
    }
    cleaned.push(trimmed);
  }
  return cleaned;
}

function sanitizeDimension(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value);
}

export async function POST(request: Request) {
  if (!hasValidIngestSecret(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mtxPath = searchParams.get("path") ?? searchParams.get("channel");

  const body = (await request
    .json()
    .catch(() => null)) as RecordingPayload | null;

  if (!body || !body.mp4Path) {
    return new NextResponse(null, { status: 400 });
  }

  const channel = await resolveIngestChannel(mtxPath);
  if (!channel) {
    return new NextResponse(null, { status: 404 });
  }

  const pending = await findTargetVideo(channel.id, body.recordedAt ?? null);
  if (!pending) {
    return new NextResponse(null, { status: 404 });
  }

  const update: VideoUpdate = {
    status: "ready",
    mp4_path: body.mp4Path,
    duration_s: body.durationS ?? null,
    published_at: new Date().toISOString(),
  };

  if (!pending.thumbnail_path) {
    update.thumbnail_path = body.thumbnailPath ?? null;
  }

  const width = sanitizeDimension(body.width);
  if (width !== undefined) {
    update.width = width;
  }
  const height = sanitizeDimension(body.height);
  if (height !== undefined) {
    update.height = height;
  }

  if (body.previewPaths !== undefined) {
    const previewPaths = sanitizePreviewPaths(body.previewPaths);
    if (previewPaths === null) {
      return new NextResponse(null, { status: 400 });
    }
    update.preview_paths = previewPaths;
  }

  const { error: updateError } = await supabaseAdmin
    .from("videos")
    .update(update)
    .eq("id", pending.id);

  if (updateError) {
    console.error(updateError);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

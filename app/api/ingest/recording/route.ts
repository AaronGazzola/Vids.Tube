import type { Database } from "@/supabase/types";
import { NextResponse } from "next/server";
import { hasValidIngestSecret, supabaseAdmin } from "../_shared";

type VideoUpdate = Database["public"]["Tables"]["videos"]["Update"];

type RecordingPayload = {
  mp4Path?: string;
  thumbnailPath?: string;
  durationS?: number;
  width?: number;
  height?: number;
  previewPaths?: string[];
};

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

  const INGEST_CHANNEL_SLUG = "azanything";

  const body = (await request
    .json()
    .catch(() => null)) as RecordingPayload | null;

  if (!body || !body.mp4Path) {
    return new NextResponse(null, { status: 400 });
  }

  const { data: channel, error: channelError } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", INGEST_CHANNEL_SLUG)
    .maybeSingle();

  if (channelError) {
    console.error(channelError);
    return new NextResponse(null, { status: 500 });
  }
  if (!channel) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: pending, error: pendingError } = await supabaseAdmin
    .from("videos")
    .select("id, thumbnail_path")
    .eq("channel_id", channel.id)
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingError) {
    console.error(pendingError);
    return new NextResponse(null, { status: 500 });
  }
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

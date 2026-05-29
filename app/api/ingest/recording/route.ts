import { NextResponse } from "next/server";
import { hasValidIngestSecret, supabaseAdmin } from "../_shared";

export async function POST(request: Request) {
  if (!hasValidIngestSecret(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("path") ?? searchParams.get("channel");
  if (!slug) {
    return new NextResponse(null, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    mp4Path?: string;
    thumbnailPath?: string;
    durationS?: number;
  } | null;

  if (!body || !body.mp4Path) {
    return new NextResponse(null, { status: 400 });
  }

  const { data: channel, error: channelError } = await supabaseAdmin
    .from("channels")
    .select("id")
    .eq("slug", slug)
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
    .select("id")
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

  const { error: updateError } = await supabaseAdmin
    .from("videos")
    .update({
      status: "ready",
      mp4_path: body.mp4Path,
      thumbnail_path: body.thumbnailPath ?? null,
      duration_s: body.durationS ?? null,
      published_at: new Date().toISOString(),
    })
    .eq("id", pending.id);

  if (updateError) {
    console.error(updateError);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

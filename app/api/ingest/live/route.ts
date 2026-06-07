import { NextResponse } from "next/server";
import { decideGoLive } from "@/lib/stream";
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

  const { data: channel, error: channelError } = await supabaseAdmin
    .from("channels")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (channelError) {
    console.error(channelError);
    return new NextResponse(null, { status: 500 });
  }
  if (!channel) {
    return new NextResponse(null, { status: 404 });
  }

  const host = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";
  const hlsPath = `${host}/${channel.slug}/index.m3u8`;
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("streams")
    .select("id, status, last_seen_at")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error(existingError);
    return new NextResponse(null, { status: 500 });
  }

  const decision = decideGoLive(existing, Date.now());

  if (decision.action === "reconnect") {
    const { error } = await supabaseAdmin
      .from("streams")
      .update({ hls_path: hlsPath, last_seen_at: now })
      .eq("id", decision.streamId);
    if (error) {
      console.error(error);
      return new NextResponse(null, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (decision.action === "new-after-stale") {
    const { error } = await supabaseAdmin
      .from("streams")
      .update({ status: "ended", ended_at: now })
      .eq("id", decision.staleStreamId);
    if (error) {
      console.error(error);
      return new NextResponse(null, { status: 500 });
    }
  }

  const { error } = await supabaseAdmin.from("streams").insert({
    channel_id: channel.id,
    status: "live",
    hls_path: hlsPath,
    started_at: now,
    last_seen_at: now,
  });
  if (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

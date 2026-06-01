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

  const { data: liveStream, error: liveError } = await supabaseAdmin
    .from("streams")
    .select("id, title")
    .eq("channel_id", channel.id)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (liveError) {
    console.error(liveError);
    return new NextResponse(null, { status: 500 });
  }
  if (!liveStream) {
    return NextResponse.json({ ok: true });
  }

  const { error: endError } = await supabaseAdmin
    .from("streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", liveStream.id);

  if (endError) {
    console.error(endError);
    return new NextResponse(null, { status: 500 });
  }

  const { data: existingProcessing, error: existingVideoError } =
    await supabaseAdmin
      .from("videos")
      .select("id")
      .eq("source_stream_id", liveStream.id)
      .eq("status", "processing")
      .maybeSingle();

  if (existingVideoError) {
    console.error(existingVideoError);
    return new NextResponse(null, { status: 500 });
  }

  if (!existingProcessing) {
    const { error: videoError } = await supabaseAdmin.from("videos").insert({
      channel_id: channel.id,
      source_stream_id: liveStream.id,
      status: "processing",
      title: liveStream.title,
    });
    if (videoError) {
      console.error(videoError);
      return new NextResponse(null, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

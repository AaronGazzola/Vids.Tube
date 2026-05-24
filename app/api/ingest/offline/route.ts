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

  const { error } = await supabaseAdmin
    .from("streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("channel_id", channel.id)
    .eq("status", "live");

  if (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

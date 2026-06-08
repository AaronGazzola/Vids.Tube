import { NextResponse } from "next/server";
import { endBroadcastSession } from "@/lib/broadcast-end";
import { hasValidIngestSecret, supabaseAdmin } from "../_shared";

export async function POST(request: Request) {
  if (!hasValidIngestSecret(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const INGEST_CHANNEL_SLUG = "azanything";

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

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id, status, title, description, thumbnail_path")
    .eq("channel_id", channel.id)
    .in("status", ["preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    console.error(sessionError);
    return new NextResponse(null, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  try {
    await endBroadcastSession(session);
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

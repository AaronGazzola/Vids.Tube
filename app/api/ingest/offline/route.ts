import { NextResponse } from "next/server";
import { endBroadcastSession } from "@/lib/broadcast-end";
import { hasValidIngestSecret, resolveIngestChannel, supabaseAdmin } from "../_shared";

export async function POST(request: Request) {
  if (!hasValidIngestSecret(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mtxPath = searchParams.get("path") ?? searchParams.get("channel");

  const channel = await resolveIngestChannel(mtxPath);
  if (!channel) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: sessions, error: sessionError } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id, status, title, description, thumbnail_path")
    .eq("channel_id", channel.id)
    .in("status", ["preview", "live"])
    .order("created_at", { ascending: false });

  if (sessionError) {
    console.error(sessionError);
    return new NextResponse(null, { status: 500 });
  }
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ ok: true });
  }

  // End every open session for the channel, not just the newest, so a stale
  // preview left behind by an earlier reconnect can't linger un-finalized when
  // the encoder finally goes offline.
  try {
    for (const session of sessions) {
      await endBroadcastSession(session);
    }
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

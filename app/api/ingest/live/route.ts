import { NextResponse } from "next/server";
import { decideGoLive } from "@/lib/stream";
import { hasValidIngestSecret, resolveIngestChannel, supabaseAdmin } from "../_shared";

export async function POST(request: Request) {
  if (!hasValidIngestSecret(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mtxPath =
    searchParams.get("path") ?? searchParams.get("channel") ?? "owner";

  const channel = await resolveIngestChannel(mtxPath);
  if (!channel) {
    return new NextResponse(null, { status: 404 });
  }

  const host = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";
  const hlsPath = `${host}/${mtxPath}/index.m3u8`;
  const now = new Date().toISOString();

  const { data: active, error: activeError } = await supabaseAdmin
    .from("streams")
    .select("id, status")
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    console.error(activeError);
    return new NextResponse(null, { status: 500 });
  }

  const decision = decideGoLive(active);

  if (decision.action === "reconnect") {
    const { error } = await supabaseAdmin
      .from("streams")
      .update({ hls_path: hlsPath, last_seen_at: now })
      .eq("id", decision.streamId);
    if (error) {
      console.error(error);
      return new NextResponse(null, { status: 500 });
    }
    // Reconnecting a live row after a disconnect closes its open reconnect gap.
    if (active?.status === "live") {
      const { error: gapError } = await supabaseAdmin
        .from("stream_gaps")
        .update({ gap_end_at: now })
        .eq("stream_id", decision.streamId)
        .is("gap_end_at", null);
      if (gapError) {
        console.error(gapError);
        return new NextResponse(null, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (decision.action === "claim") {
    const { error } = await supabaseAdmin
      .from("streams")
      .update({
        status: "preview",
        hls_path: hlsPath,
        started_at: now,
        last_seen_at: now,
      })
      .eq("id", decision.streamId)
      .in("status", ["draft", "scheduled"]);
    if (error) {
      console.error(error);
      return new NextResponse(null, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin.from("streams").insert({
    channel_id: channel.id,
    status: "preview",
    created_in_ui: false,
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

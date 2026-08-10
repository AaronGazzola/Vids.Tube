import { NextResponse } from "next/server";
import { reapStaleProcessingVods } from "@/lib/broadcast-end";
import { variantPlaylistUrl } from "@/lib/master-playlist";
import { decideGoLive } from "@/lib/stream";
import { hasValidIngestSecret, resolveIngestChannel, supabaseAdmin } from "../_shared";

const RECENT_END_GRACE_MS = 10 * 60 * 1000;

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

  reapStaleProcessingVods(channel.id).catch((e) => console.error(e));

  const host = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";
  const hlsPath = variantPlaylistUrl(host, mtxPath);
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

  // The encoder is still (or again) running with no active session. If a
  // broadcast ended moments ago (manual End while OBS kept streaming), carry
  // its details onto the fresh preview so re-going-live is one click.
  const { data: recentEnded } = await supabaseAdmin
    .from("streams")
    .select("title, description, thumbnail_path, ended_at")
    .eq("channel_id", channel.id)
    .eq("status", "ended")
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const endedRecently =
    recentEnded?.ended_at &&
    Date.now() - new Date(recentEnded.ended_at).getTime() <=
      RECENT_END_GRACE_MS;
  if (endedRecently) {
    console.error(
      `ingest/live: encoder continued after a manual end on channel ${channel.id}; new preview inherits the ended broadcast's details`
    );
  }

  const { error } = await supabaseAdmin.from("streams").insert({
    channel_id: channel.id,
    status: "preview",
    created_in_ui: false,
    hls_path: hlsPath,
    started_at: now,
    last_seen_at: now,
    ...(endedRecently
      ? {
          title: recentEnded.title,
          description: recentEnded.description,
          thumbnail_path: recentEnded.thumbnail_path,
        }
      : {}),
  });
  if (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

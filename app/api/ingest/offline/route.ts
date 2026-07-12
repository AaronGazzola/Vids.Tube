import { NextResponse } from "next/server";
import { previewRevertTarget } from "@/lib/stream";
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

  const { data: active, error: activeError } = await supabaseAdmin
    .from("streams")
    .select(
      "id, channel_id, status, title, description, thumbnail_path, scheduled_start_at, created_in_ui"
    )
    .eq("channel_id", channel.id)
    .in("status", ["preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    console.error(activeError);
    return new NextResponse(null, { status: 500 });
  }

  // Idempotent: MediaMTX fires runOnNotReady on every disconnect, including brief
  // blips. Nothing connected (or only draft/scheduled) is a no-op.
  if (!active) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (active.status === "preview") {
      // Encoder dropped before go-live: never create a VOD. Revert to the row's
      // origin (scheduled/draft) or delete an ad-hoc preview, clearing the feed.
      const target = previewRevertTarget(active);
      if (target === "delete") {
        const { error } = await supabaseAdmin
          .from("streams")
          .delete()
          .eq("id", active.id)
          .eq("status", "preview");
        if (error) {
          console.error(error);
          return new NextResponse(null, { status: 500 });
        }
      } else {
        const { error } = await supabaseAdmin
          .from("streams")
          .update({
            status: target,
            hls_path: null,
            started_at: null,
            live_at: null,
            last_seen_at: null,
          })
          .eq("id", active.id)
          .eq("status", "preview");
        if (error) {
          console.error(error);
          return new NextResponse(null, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // status === "live": never end on disconnect. Keep the stream live and open a
    // reconnect gap (idempotent — a partial unique index rejects a second open gap).
    // Only the owner's End action ends a live broadcast.
    const { error: gapError } = await supabaseAdmin
      .from("stream_gaps")
      .insert({ stream_id: active.id });
    if (gapError && gapError.code !== "23505") {
      console.error(gapError);
      return new NextResponse(null, { status: 500 });
    }
  } catch (error) {
    console.error(error);
    return new NextResponse(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

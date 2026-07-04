import { NextResponse } from "next/server";
import { decideGoLive, SCHEDULED_CLAIM_GRACE_MS } from "@/lib/stream";
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

  const claimCutoff = new Date(Date.now() - SCHEDULED_CLAIM_GRACE_MS).toISOString();
  const { data: scheduled, error: scheduledError } = await supabaseAdmin
    .from("streams")
    .select("id, status, scheduled_start_at")
    .eq("channel_id", channel.id)
    .eq("status", "scheduled")
    .gte("scheduled_start_at", claimCutoff)
    .order("scheduled_start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (scheduledError) {
    console.error(scheduledError);
    return new NextResponse(null, { status: 500 });
  }

  const decision = decideGoLive(existing, Date.now(), scheduled);

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

  if (decision.action === "claim-scheduled") {
    const { error } = await supabaseAdmin
      .from("streams")
      .update({
        status: "preview",
        hls_path: hlsPath,
        started_at: now,
        last_seen_at: now,
      })
      .eq("id", decision.streamId)
      .eq("status", "scheduled");
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
    status: "preview",
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

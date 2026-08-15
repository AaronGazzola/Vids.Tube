import { supabaseAdmin } from "@/supabase/admin-client";
import { bearerToken, overlayCorsHeaders } from "@/lib/overlay-cors";
import { overlayEventsFor, OVERLAY_EVENTS_LIMIT } from "@/lib/overlay-events";
import { untrustedAudience, verifyOverlayToken } from "@/lib/overlay-token";
import { NextResponse } from "next/server";

// How far back a caller with no cursor is allowed to reach. A frame connecting
// for the first time gets the recent past, never everything since the
// installation was created: an overlay replaying an hour of commands on load is
// worse than missing them.
const COLD_START_MS = 60_000;

function refused() {
  return NextResponse.json(
    { error: "invalid_token" },
    { status: 401, headers: overlayCorsHeaders() }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: overlayCorsHeaders() });
}

export async function GET(request: Request) {
  const presented = bearerToken(request);
  if (!presented) {
    return refused();
  }

  const overlayId = untrustedAudience(presented);
  if (!overlayId) {
    return refused();
  }

  const { data: secretRow, error: secretError } = await supabaseAdmin
    .from("overlay_secrets")
    .select("secret")
    .eq("overlay_id", overlayId)
    .maybeSingle();
  if (secretError) {
    console.error(secretError);
    return refused();
  }
  if (!secretRow) {
    return refused();
  }

  const claims = verifyOverlayToken(presented, secretRow.secret);
  if (!claims) {
    return refused();
  }

  const coldStart = new Date(Date.now() - COLD_START_MS).toISOString();
  const asked = new URL(request.url).searchParams.get("since");
  const sinceIso =
    asked && !Number.isNaN(Date.parse(asked)) && asked > coldStart
      ? asked
      : coldStart;

  const events = await overlayEventsFor({
    channelId: claims.channel,
    overlayId,
    secret: secretRow.secret,
    sinceIso,
  });

  return NextResponse.json(
    { events, limit: OVERLAY_EVENTS_LIMIT },
    { headers: overlayCorsHeaders() }
  );
}

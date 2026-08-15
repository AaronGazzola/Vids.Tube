import { supabaseAdmin } from "@/supabase/admin-client";
import {
  refreshOverlayToken,
  untrustedAudience,
  verifyOverlayToken,
} from "@/lib/overlay-token";
import { overlayCorsHeaders } from "@/lib/overlay-cors";
import { NextResponse } from "next/server";

const corsHeaders = overlayCorsHeaders;

// One refusal for every failure. A caller learns nothing from the difference
// between an expired token, a forged one and an overlay that no longer exists,
// and an overlay author only ever needs one answer: ask for a new one.
function refused() {
  return NextResponse.json(
    { error: "invalid_token" },
    { status: 401, headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// A frame open for hours renews without reloading, because reloading restarts
// whatever the overlay was running. This stands in for the page pushing fresh
// tokens over the message channel, which does not exist yet.
export async function POST(request: Request) {
  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return refused();
  }
  const presented = typeof body.token === "string" ? body.token : null;
  if (!presented) {
    return refused();
  }

  // The audience says which secret to fetch. It decides nothing: the signature
  // made with that secret is what says whether the token is real.
  const overlayId = untrustedAudience(presented);
  if (!overlayId) {
    return refused();
  }

  const { data: secretRow, error } = await supabaseAdmin
    .from("overlay_secrets")
    .select("secret")
    .eq("overlay_id", overlayId)
    .maybeSingle();
  if (error) {
    console.error(error);
    return refused();
  }
  if (!secretRow) {
    return refused();
  }

  const claims = verifyOverlayToken(presented, secretRow.secret);
  if (!claims) {
    return refused();
  }

  const refreshed = refreshOverlayToken(claims, secretRow.secret);
  return NextResponse.json(refreshed, { headers: corsHeaders() });
}

import { supabaseAdmin } from "@/supabase/admin-client";
import {
  refreshOverlayToken,
  untrustedAudience,
  verifyOverlayToken,
} from "@/lib/overlay-token";
import { NextResponse } from "next/server";

// The caller is the framed overlay, which is on another origin by definition, so
// without these headers the browser refuses the request before it is ever sent.
// The origin allowed is the same build-time one the framing policy names, so this
// endpoint can be reached by exactly what may be framed and nothing else.
function corsHeaders(): Record<string, string> {
  const configured = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!configured) {
    return {};
  }
  try {
    return {
      "Access-Control-Allow-Origin": new URL(configured).origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  } catch {
    return {};
  }
}

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

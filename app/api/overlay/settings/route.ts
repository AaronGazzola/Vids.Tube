import { supabaseAdmin } from "@/supabase/admin-client";
import { bearerToken, overlayCorsHeaders } from "@/lib/overlay-cors";
import {
  parseSettingsFields,
  parseSettingsValues,
  resolveSettings,
} from "@/lib/overlay-settings";
import { untrustedAudience, verifyOverlayToken } from "@/lib/overlay-token";
import { NextResponse } from "next/server";

// One refusal for every failure: absent, malformed, expired and forged are all
// the same answer, and an overlay only ever needs one — ask for a new token.
function refused() {
  return NextResponse.json(
    { error: "invalid_token" },
    { status: 401, headers: overlayCorsHeaders() }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: overlayCorsHeaders() });
}

// The token is the credential here rather than the subject, which is why it
// arrives as a bearer header and not in a body the way the exchange endpoint
// takes it. It names one installation, and reads that installation's settings
// and no other's.
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

  const { data, error } = await supabaseAdmin
    .from("channel_overlays")
    .select("settings, overlays!inner (settings_fields)")
    .eq("id", claims.install)
    .eq("overlay_id", overlayId)
    .maybeSingle();
  if (error) {
    console.error(error);
    return refused();
  }
  if (!data) {
    return refused();
  }

  const fields = parseSettingsFields(data.overlays.settings_fields);
  const stored = parseSettingsValues(data.settings);
  return NextResponse.json(
    { settings: resolveSettings(fields, stored) },
    { headers: overlayCorsHeaders() }
  );
}

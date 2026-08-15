import { supabaseAdmin } from "@/supabase/admin-client";
import type { OverlayInstallation } from "@/lib/overlay-frame";
import { mintInstallationToken } from "@/lib/overlay-token";
import {
  parseSettingsFields,
  parseSettingsValues,
  resolveSettings,
} from "@/lib/overlay-settings";

// Server only, by construction rather than by a guard: it reads the service role
// client and mints with a secret, and every caller is a "use server" action.
//
// One place that decides what a channel frames, so the audience surface and the
// owner's composer cannot disagree about it. The token is minted here rather than
// stored: it expires, and a stored one would be stale before it was read.
export async function installationForChannel(
  channelId: string
): Promise<OverlayInstallation | null> {
  const { data, error } = await supabaseAdmin
    .from("channel_overlays")
    .select("id, overlay_id, settings, overlays!inner (entry_url, status, settings_fields)")
    .eq("channel_id", channelId)
    .eq("enabled", true)
    .eq("overlays.status", "published")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to fetch installed overlay");
  }
  if (!data) {
    return null;
  }

  const { data: secretRow, error: secretError } = await supabaseAdmin
    .from("overlay_secrets")
    .select("secret")
    .eq("overlay_id", data.overlay_id)
    .maybeSingle();
  if (secretError) {
    console.error(secretError);
    throw new Error("Failed to fetch overlay secret");
  }
  // An overlay with no secret cannot be handed a token it could verify, and
  // framing it anyway would put an overlay on stream that has been told nothing
  // it can trust. Refusing is the honest outcome.
  if (!secretRow) {
    console.error(
      "installed overlay has no signing secret, so nothing can be framed for it"
    );
    return null;
  }

  return {
    installId: data.id,
    entryUrl: data.overlays.entry_url,
    channelId,
    settings: resolveSettings(
      parseSettingsFields(data.overlays.settings_fields),
      parseSettingsValues(data.settings)
    ),
    token: mintInstallationToken({
      overlayId: data.overlay_id,
      channelId,
      installId: data.id,
      secret: secretRow.secret,
    }),
  };
}

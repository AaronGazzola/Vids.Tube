import { createClient } from "@supabase/supabase-js";
import { newOverlaySecret } from "../lib/overlay-token";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// The first registry row. Its entry address is whatever the deployment already
// framed, so this migrates one build-time constant into one row rather than
// inventing an address, and a hardcoded address never enters version control.
async function main() {
  const entryUrl = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!entryUrl) {
    console.error("NEXT_PUBLIC_GAME_EMBED_URL is not set; nothing to seed");
    process.exit(1);
  }

  const { data: overlay, error } = await admin
    .from("overlays")
    .upsert(
      {
        slug: "dragon",
        name: "Dragon",
        entry_url: entryUrl,
        status: "published",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id")
    .maybeSingle();
  if (error || !overlay) {
    console.error(error);
    process.exit(1);
  }

  // Only ever written when absent. Regenerating a secret invalidates every token
  // already handed to a running browser source, so re-running this script must
  // never be the thing that does it.
  const { data: existingSecret, error: secretReadError } = await admin
    .from("overlay_secrets")
    .select("overlay_id")
    .eq("overlay_id", overlay.id)
    .maybeSingle();
  if (secretReadError) {
    console.error(secretReadError);
    process.exit(1);
  }
  if (!existingSecret) {
    const { error: secretError } = await admin
      .from("overlay_secrets")
      .insert({ overlay_id: overlay.id, secret: newOverlaySecret() });
    if (secretError) {
      console.error(secretError);
      process.exit(1);
    }
  }

  const { data: channel, error: channelError } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (channelError) {
    console.error(channelError);
    process.exit(1);
  }
  if (!channel) {
    console.error("No channel exists to install the overlay on");
    process.exit(1);
  }

  const { error: installError } = await admin
    .from("channel_overlays")
    .upsert(
      { channel_id: channel.id, overlay_id: overlay.id, enabled: true },
      { onConflict: "channel_id,overlay_id" }
    );
  if (installError) {
    console.error(installError);
    process.exit(1);
  }

  const { count: overlayCount } = await admin
    .from("overlays")
    .select("id", { count: "exact", head: true });
  const { count: installCount } = await admin
    .from("channel_overlays")
    .select("id", { count: "exact", head: true });
  const { count: secretCount } = await admin
    .from("overlay_secrets")
    .select("overlay_id", { count: "exact", head: true });

  console.warn(
    `registry rows: ${overlayCount ?? 0}, installations: ${installCount ?? 0}, secrets: ${secretCount ?? 0}`
  );
}

main();

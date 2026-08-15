import { createClient } from "@supabase/supabase-js";
import { parseOverlayCommands } from "../lib/overlay-commands";
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
// The configured value is a link copied out of the studio, so it carries whatever
// the studio was showing at the time: an encoded sim configuration the game
// ignores and logs an error about on every single load, an inspect-controls flag
// that has no business on a stream, and a tab name. Only the rig and its leg
// weight mean anything to the overlay.
//
// Normalised here rather than by editing the row, or the next seed puts the stale
// value straight back.
function normaliseEntryUrl(raw: string): string {
  const url = new URL(raw);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const kept = new URLSearchParams();
  const rig = hash.get("rig");
  if (rig) kept.set("rig", rig);
  const legWeight = hash.get("legw");
  if (legWeight) kept.set("legw", legWeight);
  url.hash = kept.toString() ? `#${kept}` : "";
  url.search = "";
  return url.toString();
}

async function main() {
  const configured = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!configured) {
    console.error("NEXT_PUBLIC_GAME_EMBED_URL is not set; nothing to seed");
    process.exit(1);
  }
  const entryUrl = normaliseEntryUrl(configured);
  if (entryUrl !== configured) {
    console.warn("entry address normalised: dropped everything but the rig and leg weight");
  }

  const { data: overlay, error } = await admin
    .from("overlays")
    .upsert(
      {
        slug: "dragon",
        name: "Dragon",
        entry_url: entryUrl,
        status: "published",
        // The overlay's own declaration. Authored by its owner, which for this
        // row is eco3d, and stored here because this is where the streamer's
        // editor and the streamer's command registry read it. The host stores
        // both and interprets neither.
        settings_fields: [
          {
            key: "creatureName",
            label: "Creature name",
            type: "text",
            default: "Dragon",
            help: "What your chatters call it",
          },
        ],
        commands: [
          {
            keyword: "feed",
            description: "Feed the creature",
            cooldown_s: 30,
          },
        ],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id, commands")
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

  // Installing through the Overlays tab registers an overlay's declared commands.
  // Seeding has to do the same, or a row that was already installed before the
  // declaration existed would never gain them. A keyword the channel already uses
  // is left alone, exactly as the install action leaves it.
  const declared = parseOverlayCommands(overlay.commands);
  if (declared.length > 0) {
    const { data: taken } = await admin
      .from("chat_commands")
      .select("keyword")
      .eq("channel_id", channel.id)
      .in(
        "keyword",
        declared.map((c) => c.keyword)
      );
    const used = new Set((taken ?? []).map((row) => row.keyword));
    const free = declared.filter((c) => !used.has(c.keyword));
    if (free.length > 0) {
      const { error: commandError } = await admin.from("chat_commands").insert(
        free.map((c, index) => ({
          channel_id: channel.id,
          overlay_id: overlay.id,
          keyword: c.keyword,
          kind: "overlay",
          description: c.description,
          cooldown_s: c.cooldown_s ?? 30,
          max_per_stream: c.max_per_stream ?? null,
          sort_order: 100 + index,
        }))
      );
      if (commandError) {
        console.error(commandError);
        process.exit(1);
      }
    }
  }

  const { count: commandCount } = await admin
    .from("chat_commands")
    .select("id", { count: "exact", head: true })
    .eq("overlay_id", overlay.id);

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
    `registry rows: ${overlayCount ?? 0}, installations: ${installCount ?? 0}, secrets: ${secretCount ?? 0}, commands: ${commandCount ?? 0}`
  );
}

main();

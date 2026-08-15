import { createClient } from "@supabase/supabase-js";
import { opaqueSubject } from "../lib/overlay-token";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let failed = false;

function check(label: string, pass: boolean, detail: string) {
  if (!pass) failed = true;
  console.warn(`${pass ? "ok  " : "FAIL"}  ${label} — ${detail}`);
}

// The pseudonymous-viewer promise is the one property here that cannot be added
// back later, so it is checked against real derivation rather than reasoned about.
async function main() {
  const { data: channels, error } = await admin
    .from("channels")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(2);
  if (error || !channels?.length) {
    console.error(error ?? "no channels");
    process.exit(1);
  }

  const channelA = channels[0].id;
  const channelB = channels[1]?.id ?? "00000000-0000-4000-8000-000000000001";
  const overlayA = "11111111-1111-4111-8111-111111111111";
  const overlayB = "22222222-2222-4222-8222-222222222222";
  const secretA = "secret-for-overlay-a";
  const secretB = "secret-for-overlay-b";
  const chatter = "participant-key-of-one-chatter";

  const base = opaqueSubject(overlayA, channelA, chatter, secretA);

  check(
    "the same chatter is the same actor to one overlay on one channel",
    opaqueSubject(overlayA, channelA, chatter, secretA) === base,
    "a repeat command attributes to the same player"
  );
  check(
    "the same chatter is a different actor to another overlay",
    opaqueSubject(overlayB, channelA, chatter, secretB) !== base,
    "two games cannot tell they share a player"
  );
  check(
    "the same chatter is a different actor on another channel",
    opaqueSubject(overlayA, channelB, chatter, secretA) !== base,
    "one game cannot follow a player between channels"
  );
  check(
    "the participant key is not recoverable from the actor",
    !base.includes(chatter) && !base.includes("participant"),
    "the actor carries nothing of the key it came from"
  );

  // The registry has to admit an overlay command, or none of the above matters.
  const { data: probe, error: probeError } = await admin
    .from("overlays")
    .upsert(
      {
        slug: "events-probe",
        name: "Events probe",
        entry_url: "https://example.invalid/probe",
        status: "draft",
        commands: [{ keyword: "probe", description: "A probe" }],
      },
      { onConflict: "slug" }
    )
    .select("id")
    .maybeSingle();
  if (probeError || !probe) {
    console.error(probeError);
    process.exit(1);
  }

  const { error: kindError } = await admin.from("chat_commands").insert({
    channel_id: channelA,
    overlay_id: probe.id,
    keyword: "overlayprobe",
    kind: "overlay",
    description: "A probe",
  });
  check(
    "an overlay command is admitted by the registry",
    !kindError,
    kindError ? kindError.message : "inserted"
  );

  await admin
    .from("chat_commands")
    .delete()
    .eq("channel_id", channelA)
    .eq("keyword", "overlayprobe");
  await admin.from("overlays").delete().eq("id", probe.id);

  if (failed) {
    process.exit(1);
  }
}

main();

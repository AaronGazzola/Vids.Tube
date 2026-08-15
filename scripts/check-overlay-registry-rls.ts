import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

let failed = false;

function check(label: string, pass: boolean, detail: string) {
  if (!pass) failed = true;
  console.warn(`${pass ? "ok  " : "FAIL"}  ${label} — ${detail}`);
}

// Reads a signed-out client's view of the registry. The audience surface reaches
// these rows through the service role behind the layout token, so nothing here
// depends on anon read; the point is that a draft overlay and another channel's
// installations are not public.
async function main() {
  const { count: overlayCount, error: overlayError } = await admin
    .from("overlays")
    .select("id", { count: "exact", head: true });
  check(
    "overlays table exists",
    !overlayError,
    overlayError ? overlayError.message : `${overlayCount ?? 0} rows`
  );

  const { count: installCount, error: installError } = await admin
    .from("channel_overlays")
    .select("id", { count: "exact", head: true });
  check(
    "channel_overlays table exists",
    !installError,
    installError ? installError.message : `${installCount ?? 0} rows`
  );

  if (overlayError || installError) {
    process.exit(1);
  }

  const probeSlug = "rls-probe-draft";
  const { data: probe, error: probeError } = await admin
    .from("overlays")
    .upsert(
      {
        slug: probeSlug,
        name: "RLS probe",
        entry_url: "https://example.invalid/probe",
        status: "draft",
      },
      { onConflict: "slug" }
    )
    .select("id")
    .maybeSingle();
  if (probeError || !probe) {
    console.error(probeError);
    process.exit(1);
  }

  const { data: draftSeen } = await anon
    .from("overlays")
    .select("id")
    .eq("id", probe.id);
  check(
    "a draft overlay is not public",
    (draftSeen ?? []).length === 0,
    `${(draftSeen ?? []).length} rows visible signed out`
  );

  await admin.from("overlays").update({ status: "published" }).eq("id", probe.id);
  const { data: publishedSeen } = await anon
    .from("overlays")
    .select("id")
    .eq("id", probe.id);
  check(
    "a published overlay is public",
    (publishedSeen ?? []).length === 1,
    `${(publishedSeen ?? []).length} rows visible signed out`
  );

  const { data: installsSeen } = await anon
    .from("channel_overlays")
    .select("id");
  check(
    "installations are not public",
    (installsSeen ?? []).length === 0,
    `${(installsSeen ?? []).length} rows visible signed out`
  );

  const { error: writeError } = await anon
    .from("channel_overlays")
    .insert({ channel_id: crypto.randomUUID(), overlay_id: probe.id });
  check(
    "a signed-out client cannot install",
    Boolean(writeError),
    writeError ? writeError.message : "insert succeeded"
  );

  // The signing secret is the one value here that must never be readable by a
  // client, and overlays is world-readable when published, so the secret lives in
  // a table with row level security and no policies at all.
  await admin
    .from("overlay_secrets")
    .upsert({ overlay_id: probe.id, secret: "probe-secret" });

  const { data: secretSeen } = await anon
    .from("overlay_secrets")
    .select("overlay_id")
    .eq("overlay_id", probe.id);
  check(
    "a signing secret is not public, even for a published overlay",
    (secretSeen ?? []).length === 0,
    `${(secretSeen ?? []).length} rows visible signed out`
  );

  const { error: secretWriteError } = await anon
    .from("overlay_secrets")
    .insert({ overlay_id: probe.id, secret: "forged" });
  check(
    "a signed-out client cannot write a signing secret",
    Boolean(secretWriteError),
    secretWriteError ? secretWriteError.message : "insert succeeded"
  );

  // Settings live on channel_overlays, which is owner-only, so a signed-out
  // client must not be able to read or rewrite what a streamer configured.
  const { data: settingsSeen } = await anon
    .from("channel_overlays")
    .select("settings")
    .limit(1);
  check(
    "another channel's settings are not public",
    (settingsSeen ?? []).length === 0,
    `${(settingsSeen ?? []).length} rows visible signed out`
  );

  const { data: rewritten } = await anon
    .from("channel_overlays")
    .update({ settings: { forged: true } })
    .neq("channel_id", "00000000-0000-4000-8000-000000000000")
    .select("id");
  check(
    "a signed-out client cannot rewrite settings",
    (rewritten ?? []).length === 0,
    `${(rewritten ?? []).length} rows updated`
  );

  await admin.from("overlays").delete().eq("id", probe.id);

  if (failed) {
    process.exit(1);
  }
}

main();

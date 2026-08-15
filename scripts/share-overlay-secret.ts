import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Hands one overlay's signing secret to the deployment that owns that overlay.
//
// The value is piped straight into Doppler's stdin and never printed, never put
// on a command line where a process listing would show it, and never written to
// disk. What is reported is the shape of what happened, not the thing itself.
//
// This is the manual step a developer portal would replace once strangers write
// overlays. For a first-party overlay, both ends are the same person.
async function main() {
  const [slug, project, config, varName] = process.argv.slice(2);
  if (!slug || !project || !config || !varName) {
    console.error(
      "usage: share-overlay-secret <overlay-slug> <doppler-project> <doppler-config> <VAR_NAME>"
    );
    process.exit(1);
  }

  const { data: overlay, error } = await admin
    .from("overlays")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !overlay) {
    console.error(error ?? `no overlay with slug "${slug}"`);
    process.exit(1);
  }

  const { data: row, error: secretError } = await admin
    .from("overlay_secrets")
    .select("secret")
    .eq("overlay_id", overlay.id)
    .maybeSingle();
  if (secretError || !row) {
    console.error(secretError ?? `overlay "${slug}" has no signing secret`);
    process.exit(1);
  }

  const doppler = spawn(
    "doppler",
    [
      "secrets",
      "set",
      varName,
      "--project",
      project,
      "--config",
      config,
      "--silent",
    ],
    { stdio: ["pipe", "ignore", "inherit"], shell: true }
  );
  doppler.stdin.write(row.secret);
  doppler.stdin.end();

  doppler.on("close", (code) => {
    if (code !== 0) {
      console.error(`doppler exited ${code}`);
      process.exit(1);
    }
    console.warn(
      `set ${varName} in ${project}/${config} from overlay "${overlay.name}" (${row.secret.length} characters)`
    );
  });
}

main();

// Proves the rename did not move, resize or hide anything.
//
// Run it before the migration with --snapshot to record every layout's geometry
// under the old key, then after with --check to compare against the new key.
// The snapshot is written beside the script rather than to the database, so this
// never writes to a saved layout.
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { Database } from "../supabase/types";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const OLD_KEY = "members";
const NEW_KEY = "messageBanner";
const SNAPSHOT = "message-banner-snapshot.json";

type Geometry = {
  box: unknown;
  visible: unknown;
  opacity: unknown;
  otherBoxes: Record<string, unknown>;
};

function geometryOf(config: unknown, key: string): Geometry {
  const c = (config ?? {}) as Record<string, Record<string, unknown>>;
  const otherBoxes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c.boxes ?? {})) {
    if (k !== OLD_KEY && k !== NEW_KEY) otherBoxes[k] = v;
  }
  return {
    box: c.boxes?.[key] ?? null,
    visible: c.visible?.[key] ?? null,
    opacity: c.boxOpacity?.[key] ?? null,
    otherBoxes,
  };
}

async function load() {
  const { data, error } = await admin
    .from("overlay_layouts")
    .select("channel_id, config");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function main() {
  const mode = process.argv.includes("--check") ? "check" : "snapshot";
  const rows = await load();
  console.log(`layouts: ${rows.length}`);

  if (mode === "snapshot") {
    const out: Record<string, Geometry> = {};
    for (const row of rows) {
      out[row.channel_id] = geometryOf(row.config, OLD_KEY);
    }
    writeFileSync(SNAPSHOT, JSON.stringify(out, null, 2));
    console.log(`wrote ${SNAPSHOT}`);
    return;
  }

  if (!existsSync(SNAPSHOT)) {
    throw new Error(`no ${SNAPSHOT} — run without --check before migrating`);
  }
  const before = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Record<
    string,
    Geometry
  >;

  let failures = 0;
  for (const row of rows) {
    const was = before[row.channel_id];
    if (!was) {
      console.log(`  ${row.channel_id.slice(0, 8)}: new since the snapshot`);
      continue;
    }
    const now = geometryOf(row.config, NEW_KEY);
    const stale = geometryOf(row.config, OLD_KEY);

    const same =
      JSON.stringify(was.box) === JSON.stringify(now.box) &&
      JSON.stringify(was.visible) === JSON.stringify(now.visible) &&
      JSON.stringify(was.opacity) === JSON.stringify(now.opacity);
    const othersSame =
      JSON.stringify(was.otherBoxes) === JSON.stringify(now.otherBoxes);
    const oldGone = stale.box === null && stale.visible === null;

    if (same && othersSame && oldGone) {
      console.log(`  ${row.channel_id.slice(0, 8)}: PASS`);
    } else {
      failures += 1;
      console.log(`  ${row.channel_id.slice(0, 8)}: FAIL`);
      if (!same) console.log(`    geometry moved: ${JSON.stringify(was)} -> ${JSON.stringify(now)}`);
      if (!othersSame) console.log("    another overlay was disturbed");
      if (!oldGone) console.log("    the old key is still present");
    }
  }

  console.log(failures ? `\n${failures} layout(s) failed` : "\nevery layout kept its geometry");
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

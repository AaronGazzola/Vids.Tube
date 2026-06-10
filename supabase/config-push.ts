import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAuthConfig, patchAuthConfig, PROJECT_REF } from "./config-api";
import { buildPatch, extractRemote, loadLocal } from "./config-managed";

const here = dirname(fileURLToPath(import.meta.url));
const configTomlPath = join(here, "config.toml");

async function main() {
  const configText = readFileSync(configTomlPath, "utf8");
  const desired = loadLocal(configText);
  const willApply = process.argv.includes("--apply");

  console.error(`Project: ${PROJECT_REF}`);
  console.error("Comparing desired (config.toml) against live remote...\n");

  const patch = buildPatch(configText);
  const before = extractRemote(await getAuthConfig());
  const beforeById = new Map(before.map((f) => [f.id, f]));
  const drifted = desired.filter(
    (d) => !d.writeOnly && beforeById.get(d.id)?.value !== d.value
  );
  const secrets = desired.filter(
    (d) => d.writeOnly && d.display.startsWith("(from env")
  );

  if (drifted.length === 0 && secrets.length === 0) {
    console.error("Already in parity — nothing to push.");
    return;
  }

  if (drifted.length > 0) {
    console.error(`${drifted.length} field(s) will change:`);
    for (const d of drifted) {
      console.error(`  ${d.id}`);
      console.error(`    remote -> ${beforeById.get(d.id)?.display ?? "(missing)"}`);
      console.error(`    local  -> ${d.display}`);
    }
  }
  if (secrets.length > 0) {
    console.error(`${secrets.length} write-only secret(s) will be set:`);
    for (const d of secrets) {
      console.error(`  ${d.id} ${d.display}`);
    }
  }

  if (!willApply) {
    console.error("\nDry run. Re-run with --apply to push these managed fields.");
    return;
  }

  await patchAuthConfig(patch);
  console.error("\nPATCH applied. Verifying read-back (write-only fields skipped)...\n");

  const afterById = new Map(extractRemote(await getAuthConfig()).map((f) => [f.id, f]));
  let fail = 0;
  for (const d of desired) {
    if (d.writeOnly) {
      console.error(`  [----] ${d.id} (write-only — not verifiable)`);
      continue;
    }
    const ok = afterById.get(d.id)?.value === d.value;
    if (!ok) fail++;
    console.error(`  [${ok ? "PASS" : "FAIL"}] ${d.id}`);
  }
  if (fail > 0) {
    console.error(`\n${fail} field(s) did not match after push.`);
    process.exit(1);
  }
  console.error("\nPush verified — remote matches config.toml. Run config:pull to refresh observed state.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractRemote, loadLocal } from "./config-managed";

const here = dirname(fileURLToPath(import.meta.url));
const configTomlPath = join(here, "config.toml");
const snapshotPath = join(here, ".remote-config.json");

function main() {
  if (!existsSync(snapshotPath)) {
    console.error("No snapshot found. Run `npm run config:pull` first.");
    process.exit(1);
  }

  const desired = loadLocal(readFileSync(configTomlPath, "utf8"));
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const observed = extractRemote(snapshot.auth as Record<string, unknown>);
  const observedById = new Map(observed.map((f) => [f.id, f]));

  console.error("Managed fields — config.toml (desired) vs config.toml.remote (observed):\n");
  let drift = 0;
  for (const d of desired) {
    if (d.writeOnly) {
      console.error(`  [----] ${d.id} (write-only — not compared)`);
      continue;
    }
    const o = observedById.get(d.id);
    const match = o?.value === d.value;
    if (!match) drift++;
    console.error(`  [${match ? "MATCH" : "DRIFT"}] ${d.id}`);
    if (!match) {
      console.error(`        desired : ${d.display}`);
      console.error(`        observed: ${o?.display ?? "(missing)"}`);
    }
  }

  console.error(
    `\n${drift === 0 ? "PARITY — no drift." : `${drift} field(s) drifted.`}`
  );
  process.exit(drift === 0 ? 0 : 1);
}

main();

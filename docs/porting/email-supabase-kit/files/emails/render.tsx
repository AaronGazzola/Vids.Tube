import { render } from "@react-email/render";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import Confirmation from "./confirmation";
import EmailChange from "./email_change";
import Invite from "./invite";
import MagicLink from "./magic_link";
import Recovery from "./recovery";

const templates = {
  confirmation: Confirmation,
  recovery: Recovery,
  invite: Invite,
  magic_link: MagicLink,
  email_change: EmailChange,
};

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "templates"
);

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const [name, Component] of Object.entries(templates)) {
    const html = await render(<Component />, { pretty: true });
    const outPath = join(outDir, `${name}.html`);
    writeFileSync(outPath, html, "utf8");
    console.error(`wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

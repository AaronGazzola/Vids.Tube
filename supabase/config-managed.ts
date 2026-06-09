import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const supabaseDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(supabaseDir, "..");

export const TEMPLATE_KEYS = [
  "confirmation",
  "recovery",
  "invite",
  "magic_link",
  "email_change",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

type Sections = Record<string, Record<string, string>>;

export function parseToml(text: string): Sections {
  const sections: Sections = { "": {} };
  let cur = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      cur = sec[1];
      sections[cur] = sections[cur] ?? {};
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (kv) sections[cur][kv[1]] = kv[2].trim();
  }
  return sections;
}

const unquote = (v?: string) => (v ?? "").replace(/^["']|["']$/g, "");
const parseArray = (v?: string) =>
  !v
    ? []
    : v
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
const sortedCsv = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join(",");
const sha = (s: string) =>
  `sha256:${createHash("sha256").update(s).digest("hex").slice(0, 12)} (${s.length}B)`;

export interface ManagedField {
  id: string;
  local: (s: Sections) => string;
  remote: (auth: Record<string, unknown>) => string;
  patch: (s: Sections) => Record<string, unknown>;
  display?: (value: string) => string;
}

function templateFields(key: TemplateKey): ManagedField[] {
  const sec = `auth.email.template.${key}`;
  const readContent = (s: Sections) => {
    const path = unquote(s[sec]?.content_path);
    return path ? readFileSync(join(repoRoot, path), "utf8") : "";
  };
  return [
    {
      id: `${sec}.subject`,
      local: (s) => unquote(s[sec]?.subject),
      remote: (a) => String(a[`mailer_subjects_${key}`] ?? ""),
      patch: (s) => ({ [`mailer_subjects_${key}`]: unquote(s[sec]?.subject) }),
    },
    {
      id: `${sec}.content`,
      local: readContent,
      remote: (a) => String(a[`mailer_templates_${key}_content`] ?? ""),
      patch: (s) => ({ [`mailer_templates_${key}_content`]: readContent(s) }),
      display: sha,
    },
  ];
}

export const MANAGED: ManagedField[] = [
  {
    id: "auth.site_url",
    local: (s) => unquote(s["auth"]?.site_url),
    remote: (a) => String(a.site_url ?? ""),
    patch: (s) => ({ site_url: unquote(s["auth"]?.site_url) }),
  },
  {
    id: "auth.additional_redirect_urls",
    local: (s) => sortedCsv(parseArray(s["auth"]?.additional_redirect_urls).join(",")),
    remote: (a) => sortedCsv(String(a.uri_allow_list ?? "")),
    patch: (s) => ({
      uri_allow_list: parseArray(s["auth"]?.additional_redirect_urls).join(","),
    }),
    display: (v) => v.split(",").join(", "),
  },
  {
    id: "auth.email.enable_confirmations",
    local: (s) => String(unquote(s["auth.email"]?.enable_confirmations) === "true"),
    remote: (a) => String(a.mailer_autoconfirm === false),
    patch: (s) => ({
      mailer_autoconfirm: unquote(s["auth.email"]?.enable_confirmations) !== "true",
    }),
  },
  ...TEMPLATE_KEYS.flatMap(templateFields),
];

const show = (f: ManagedField, value: string) => (f.display ?? ((x: string) => x))(value);

export interface FieldValue {
  id: string;
  value: string;
  display: string;
}

export function loadLocal(configTomlText: string): FieldValue[] {
  const s = parseToml(configTomlText);
  return MANAGED.map((f) => {
    const value = f.local(s);
    return { id: f.id, value, display: show(f, value) };
  });
}

export function extractRemote(auth: Record<string, unknown>): FieldValue[] {
  return MANAGED.map((f) => {
    const value = f.remote(auth);
    return { id: f.id, value, display: show(f, value) };
  });
}

export function buildPatch(configTomlText: string): Record<string, unknown> {
  const s = parseToml(configTomlText);
  return Object.assign({}, ...MANAGED.map((f) => f.patch(s)));
}

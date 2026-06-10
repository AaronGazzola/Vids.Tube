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

const envName = (raw: string): string | null => {
  const m = raw.match(/^env\((.+)\)$/);
  return m ? m[1] : null;
};
const resolveEnv = (raw: string): string => {
  const name = envName(raw);
  return name ? (process.env[name] ?? "") : raw;
};

export interface ManagedField {
  id: string;
  local: (s: Sections) => string;
  remote: (auth: Record<string, unknown>) => string;
  patch: (s: Sections) => Record<string, unknown>;
  display?: (value: string) => string;
  writeOnly?: boolean;
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
  {
    id: "auth.email.smtp.host",
    local: (s) => unquote(s["auth.email.smtp"]?.host),
    remote: (a) => String(a.smtp_host ?? ""),
    patch: (s) => ({ smtp_host: unquote(s["auth.email.smtp"]?.host) }),
  },
  {
    id: "auth.email.smtp.port",
    local: (s) => unquote(s["auth.email.smtp"]?.port),
    remote: (a) => String(a.smtp_port ?? ""),
    patch: (s) => ({ smtp_port: unquote(s["auth.email.smtp"]?.port) }),
  },
  {
    id: "auth.email.smtp.user",
    local: (s) => unquote(s["auth.email.smtp"]?.user),
    remote: (a) => String(a.smtp_user ?? ""),
    patch: (s) => ({ smtp_user: unquote(s["auth.email.smtp"]?.user) }),
  },
  {
    id: "auth.email.smtp.pass",
    writeOnly: true,
    local: (s) => {
      const raw = unquote(s["auth.email.smtp"]?.pass);
      const name = envName(raw);
      if (name) return process.env[name] ? `(from env ${name})` : `(env ${name} unset)`;
      return raw ? "(literal)" : "(unset)";
    },
    remote: () => "(write-only)",
    patch: (s) => {
      const value = resolveEnv(unquote(s["auth.email.smtp"]?.pass));
      return value ? { smtp_pass: value } : {};
    },
  },
  {
    id: "auth.email.smtp.sender_name",
    local: (s) => unquote(s["auth.email.smtp"]?.sender_name),
    remote: (a) => String(a.smtp_sender_name ?? ""),
    patch: (s) => ({ smtp_sender_name: unquote(s["auth.email.smtp"]?.sender_name) }),
  },
  {
    id: "auth.email.smtp.admin_email",
    local: (s) => unquote(s["auth.email.smtp"]?.admin_email),
    remote: (a) => String(a.smtp_admin_email ?? ""),
    patch: (s) => ({ smtp_admin_email: unquote(s["auth.email.smtp"]?.admin_email) }),
  },
  ...TEMPLATE_KEYS.flatMap(templateFields),
];

const show = (f: ManagedField, value: string) => (f.display ?? ((x: string) => x))(value);

export interface FieldValue {
  id: string;
  value: string;
  display: string;
  writeOnly: boolean;
}

export function loadLocal(configTomlText: string): FieldValue[] {
  const s = parseToml(configTomlText);
  return MANAGED.map((f) => {
    const value = f.local(s);
    return { id: f.id, value, display: show(f, value), writeOnly: !!f.writeOnly };
  });
}

export function extractRemote(auth: Record<string, unknown>): FieldValue[] {
  return MANAGED.map((f) => {
    const value = f.remote(auth);
    return { id: f.id, value, display: show(f, value), writeOnly: !!f.writeOnly };
  });
}

export function buildPatch(configTomlText: string): Record<string, unknown> {
  const s = parseToml(configTomlText);
  return Object.assign({}, ...MANAGED.map((f) => f.patch(s)));
}

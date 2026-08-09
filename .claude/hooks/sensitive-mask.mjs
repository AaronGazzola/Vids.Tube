// Sessions are streamed, so a value printed into one is published. These rules
// remove the categories that would be damaging on stream.
//
// Written as plain JavaScript rather than TypeScript because the hook that uses
// them runs on every tool result: a TypeScript loader costs hundreds of
// milliseconds of startup per tool call, and plain Node costs tens.
//
// Masks keep the shape of what they hide. Two different addresses produce two
// different masks, so a result holding several accounts still reads as several
// accounts, and a result that was merely empty never looks the same as one that
// was hidden.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KEY_PREFIXES = [
  "sk-",
  "sk_live_",
  "sk_test_",
  "sb_secret_",
  "sbp_",
  "ghp_",
  "gho_",
  "github_pat_",
  "re_",
  "xoxb-",
  "dop_v1_",
];

const KEY_WORDS =
  "token|secret|key|password|passwd|authorization|bearer|credential|api[_-]?key";

const STREET_WORDS =
  "street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|place|pl|parade|pde|crescent|cres|highway|hwy|boulevard|blvd|terrace|way";

function stars(n) {
  return "*".repeat(Math.max(n, 0));
}

// aaron@gazzola.dev -> a****@g******.dev
export function maskEmail(address) {
  const at = address.lastIndexOf("@");
  if (at < 1) return address;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  const maskedLocal = local[0] + stars(local.length - 1);
  const labels = domain.split(".");
  const maskedDomain = labels
    .map((label, i) =>
      i === labels.length - 1 || !label ? label : label[0] + stars(label.length - 1)
    )
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

// The last two digits survive so two numbers stay distinguishable.
function maskPhone(number) {
  const digits = number.replace(/\D/g, "");
  const tail = digits.slice(-2);
  return `${number.trimStart().startsWith("+") ? "+" : ""}${stars(
    digits.length - 2
  )}${tail}`;
}

const RULES = [
  {
    category: "jwt",
    // Three base64url segments, the first being a header object, which is what
    // separates a token from any other dotted string.
    pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g,
    replace: () => "<jwt:masked>",
  },
  {
    category: "key",
    pattern: new RegExp(
      `\\b(?:${KEY_PREFIXES.map((p) => p.replace(/[-_]/g, "[-_]")).join(
        "|"
      )})[A-Za-z0-9_-]{8,}\\b`,
      "g"
    ),
    replace: () => "<key:masked>",
  },
  {
    category: "secret",
    // A long opaque run sitting just after something that names it a secret.
    // Record identifiers are excluded: masking every identifier would leave a
    // result that cannot be debugged.
    pattern: new RegExp(
      `((?:${KEY_WORDS})["'\\s]*[:=]["'\\s]*)([A-Za-z0-9_-]{24,})`,
      "gi"
    ),
    replace: (_m, lead, value) =>
      UUID.test(value) ? `${lead}${value}` : `${lead}<secret:masked>`,
  },
  {
    category: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: (m) => maskEmail(m),
  },
  {
    category: "phone",
    pattern: /(?<![\w.-])\+\d[\d\s().-]{7,17}\d(?![\w.-])/g,
    replace: (m) => maskPhone(m),
  },
  {
    category: "address",
    pattern: new RegExp(
      `\\b\\d+[a-z]?[\\s,]+[\\w'\\-. ]*?\\b(?:${STREET_WORDS})\\b[^\\n]*`,
      "gi"
    ),
    replace: () => "<address:masked>",
  },
];

export function maskSensitive(text) {
  if (typeof text !== "string" || !text) {
    return { text: typeof text === "string" ? text : "", masked: [] };
  }
  let out = text;
  const masked = [];
  for (const rule of RULES) {
    let count = 0;
    out = out.replace(rule.pattern, (...args) => {
      const replaced = rule.replace(...args);
      // A rule that decided to leave the value alone has not masked anything.
      if (replaced !== args[0]) count += 1;
      return replaced;
    });
    if (count) masked.push({ category: rule.category, count });
  }
  return { text: out, masked };
}

export function maskNotice(masked) {
  if (!masked.length) return "";
  const total = masked.reduce((n, m) => n + m.count, 0);
  const categories = masked.map((m) => m.category).join(", ");
  return `\n[${total} sensitive value${
    total === 1 ? "" : "s"
  } masked before this reached the session: ${categories}]`;
}

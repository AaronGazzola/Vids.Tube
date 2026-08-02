import { RESERVED_HANDLES } from "./handle";

export function normalizeHandleBase(raw: string): string {
  let h = raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (h.length === 0) h = "user";
  if (h.length < 3) h = (h + "000").slice(0, 3);
  return h.slice(0, 30);
}

export function ensureUniqueHandle(base: string, taken: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (
    candidate.length < 3 ||
    RESERVED_HANDLES.has(candidate) ||
    taken.has(candidate)
  ) {
    const suffix = `_${n}`;
    candidate = base.slice(0, 30 - suffix.length) + suffix;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

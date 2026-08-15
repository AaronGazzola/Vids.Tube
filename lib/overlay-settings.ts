export const OVERLAY_SETTINGS_FIELD_TYPES = [
  "number",
  "toggle",
  "text",
  "choice",
  "color",
] as const;

export type OverlaySettingsFieldType =
  (typeof OVERLAY_SETTINGS_FIELD_TYPES)[number];

export type OverlaySettingsField = {
  key: string;
  label: string;
  type: OverlaySettingsFieldType;
  default?: OverlaySettingsValue;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
};

export type OverlaySettingsValue = number | boolean | string;
export type OverlaySettings = Record<string, OverlaySettingsValue>;

export const OVERLAY_SETTINGS_TEXT_MAX = 500;

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptions(raw: unknown): { value: string; label: string }[] | null {
  if (!Array.isArray(raw)) return null;
  const options: { value: string; label: string }[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    if (typeof entry.value !== "string" || typeof entry.label !== "string") {
      continue;
    }
    options.push({ value: entry.value, label: entry.label });
  }
  return options.length > 0 ? options : null;
}

// A malformed entry is dropped rather than thrown on. This declaration is
// authored by an overlay, so one bad row would otherwise take down the whole
// settings panel for a streamer who did not write it and cannot fix it.
export function parseSettingsFields(raw: unknown): OverlaySettingsField[] {
  if (!Array.isArray(raw)) return [];
  const fields: OverlaySettingsField[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const { key, label, type } = entry;
    if (typeof key !== "string" || !KEY_RE.test(key) || seen.has(key)) continue;
    if (typeof label !== "string" || !label) continue;
    if (
      typeof type !== "string" ||
      !OVERLAY_SETTINGS_FIELD_TYPES.includes(type as OverlaySettingsFieldType)
    ) {
      continue;
    }

    const field: OverlaySettingsField = {
      key,
      label,
      type: type as OverlaySettingsFieldType,
    };
    if (typeof entry.help === "string") field.help = entry.help;
    if (typeof entry.min === "number" && Number.isFinite(entry.min)) {
      field.min = entry.min;
    }
    if (typeof entry.max === "number" && Number.isFinite(entry.max)) {
      field.max = entry.max;
    }
    if (typeof entry.step === "number" && entry.step > 0) field.step = entry.step;

    const options = parseOptions(entry.options);
    if (options) field.options = options;
    if (field.type === "choice" && !field.options) continue;

    if (
      typeof entry.default === "number" ||
      typeof entry.default === "boolean" ||
      typeof entry.default === "string"
    ) {
      field.default = entry.default;
    }

    seen.add(key);
    fields.push(field);
  }

  return fields;
}

export function parseSettingsValues(raw: unknown): OverlaySettings {
  if (!isRecord(raw)) return {};
  const values: OverlaySettings = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "string"
    ) {
      values[key] = value;
    }
  }
  return values;
}

// An overlay never receives a gap for a field it declared. Values it no longer
// declares are still returned: the overlay asked for them once, and the host is
// not the judge of whether it still wants them.
export function resolveSettings(
  fields: OverlaySettingsField[],
  stored: OverlaySettings
): OverlaySettings {
  const resolved: OverlaySettings = { ...stored };
  for (const field of fields) {
    if (resolved[field.key] === undefined && field.default !== undefined) {
      resolved[field.key] = field.default;
    }
  }
  return resolved;
}

export type SettingsWriteResult =
  | { ok: true; values: OverlaySettings }
  | { ok: false; reason: string };

function checkOne(
  field: OverlaySettingsField,
  value: OverlaySettingsValue
): string | null {
  if (field.type === "toggle") {
    return typeof value === "boolean" ? null : `${field.label} must be on or off`;
  }
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${field.label} must be a number`;
    }
    if (field.min !== undefined && value < field.min) {
      return `${field.label} must be at least ${field.min}`;
    }
    if (field.max !== undefined && value > field.max) {
      return `${field.label} must be at most ${field.max}`;
    }
    if (field.step !== undefined) {
      const base = field.min ?? 0;
      const steps = (value - base) / field.step;
      // Floating point: a slider at 0.7 with a step of 0.1 lands a hair off a
      // whole number of steps, and refusing that would refuse the editor's own
      // output.
      if (Math.abs(steps - Math.round(steps)) > 1e-6) {
        return `${field.label} must be a multiple of ${field.step}`;
      }
    }
    return null;
  }
  if (field.type === "choice") {
    const allowed = (field.options ?? []).map((o) => o.value);
    return typeof value === "string" && allowed.includes(value)
      ? null
      : `${field.label} must be one of the offered options`;
  }
  if (typeof value !== "string") {
    return `${field.label} must be text`;
  }
  if (value.length > OVERLAY_SETTINGS_TEXT_MAX) {
    return `${field.label} must be under ${OVERLAY_SETTINGS_TEXT_MAX} characters`;
  }
  return null;
}

// Shape, never meaning. This exists to stop a broken editor writing rubbish, not
// to police what a streamer wants their overlay to do.
//
// Written and stored are different questions: a key the overlay no longer
// declares cannot be written, but one already stored is carried forward, so a
// field withdrawn in one release and restored in the next does not lose the
// streamer's choice in between.
export function validateSettingsWrite(
  fields: OverlaySettingsField[],
  incoming: unknown,
  stored: OverlaySettings = {}
): SettingsWriteResult {
  if (!isRecord(incoming)) {
    return { ok: false, reason: "Settings must be an object" };
  }
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const declared = new Set(fields.map((f) => f.key));
  const accepted: OverlaySettings = {};

  for (const [key, value] of Object.entries(incoming)) {
    const field = byKey.get(key);
    if (!field) {
      return { ok: false, reason: `This overlay has no setting called ${key}` };
    }
    if (
      typeof value !== "number" &&
      typeof value !== "boolean" &&
      typeof value !== "string"
    ) {
      return { ok: false, reason: `${field.label} has a value of no usable kind` };
    }
    const problem = checkOne(field, value);
    if (problem) {
      return { ok: false, reason: problem };
    }
    accepted[key] = value;
  }

  const carried: OverlaySettings = {};
  for (const [key, value] of Object.entries(stored)) {
    if (!declared.has(key)) carried[key] = value;
  }

  return { ok: true, values: { ...carried, ...accepted } };
}

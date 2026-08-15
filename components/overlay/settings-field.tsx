"use client";

import { ColourPicker } from "@/app/(app)/live/colour-picker";
import { Switch } from "@/components/ui/switch";
import type {
  OverlaySettingsField,
  OverlaySettingsValue,
} from "@/lib/overlay-settings";

// One input per declared type. This component knows a field is a number between
// half and two; it does not know the number is how large a creature is, and it
// must never learn, or the host has taken on one game's vocabulary.
export function SettingsField({
  field,
  value,
  onChange,
}: {
  field: OverlaySettingsField;
  value: OverlaySettingsValue | undefined;
  onChange: (value: OverlaySettingsValue) => void;
}) {
  const label = (
    <span className="truncate" title={field.help ?? field.label}>
      {field.label}
    </span>
  );

  if (field.type === "toggle") {
    return (
      <label className="flex items-center justify-between gap-2">
        {label}
        <Switch
          aria-label={field.label}
          checked={value === true}
          onCheckedChange={(next) => onChange(next === true)}
        />
      </label>
    );
  }

  if (field.type === "number") {
    const current = typeof value === "number" ? value : (field.min ?? 0);
    const ranged = field.min !== undefined && field.max !== undefined;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          {label}
          <span className="w-10 text-right text-[10px] tabular-nums text-white/70">
            {current}
          </span>
        </div>
        <input
          type={ranged ? "range" : "number"}
          aria-label={field.label}
          min={field.min}
          max={field.max}
          step={field.step}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full min-w-0 accent-primary"
        />
      </div>
    );
  }

  if (field.type === "choice") {
    return (
      <label className="flex items-center justify-between gap-2">
        {label}
        <select
          aria-label={field.label}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded bg-white/15 px-1 py-0.5 text-[10px]"
        >
          <option value="" disabled>
            Choose
          </option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "color") {
    return (
      <div className="flex items-center justify-between gap-2">
        {label}
        <ColourPicker
          label={field.label}
          value={typeof value === "string" ? value : "#ffffff"}
          onChange={onChange}
        />
      </div>
    );
  }

  return (
    <label className="flex items-center justify-between gap-2">
      {label}
      <input
        type="text"
        aria-label={field.label}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded bg-white/15 px-1 py-0.5 text-[10px]"
      />
    </label>
  );
}

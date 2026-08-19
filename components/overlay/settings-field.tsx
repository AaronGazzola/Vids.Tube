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
    // The readout is typed into as well as read, because a slider fine enough to
    // be worth having is too fine to land on an exact value by dragging. A typed
    // number is held to the same bounds the slider is, so neither route can
    // reach a value the other cannot.
    const commit = (raw: number) => {
      if (!Number.isFinite(raw)) return;
      const lo = field.min ?? -Infinity;
      const hi = field.max ?? Infinity;
      onChange(Math.min(hi, Math.max(lo, raw)));
    };
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          {label}
          <input
            type="number"
            aria-label={`${field.label} value`}
            min={field.min}
            max={field.max}
            step={field.step}
            value={current}
            onChange={(e) => commit(Number(e.target.value))}
            className="w-14 rounded bg-white/15 px-1 py-0.5 text-right text-[10px] tabular-nums text-white/90"
          />
        </div>
        <input
          type={ranged ? "range" : "number"}
          aria-label={field.label}
          min={field.min}
          max={field.max}
          step={field.step}
          value={current}
          onChange={(e) => commit(Number(e.target.value))}
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

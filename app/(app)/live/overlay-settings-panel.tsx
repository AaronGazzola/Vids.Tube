"use client";

import { SettingsField } from "@/components/overlay/settings-field";
import type { OverlaySettings, OverlaySettingsValue } from "@/lib/overlay-settings";
import { useState } from "react";
import {
  useOverlaySettings,
  useSaveOverlaySettings,
} from "./overlay-registry.hooks";

// Edits are held until Save rather than written per keystroke, so dragging a
// slider records one change instead of one per pixel.
export function OverlaySettingsPanel({ overlayId }: { overlayId: string }) {
  const { data, isPending } = useOverlaySettings(overlayId);
  const save = useSaveOverlaySettings(overlayId);
  const [draft, setDraft] = useState<OverlaySettings | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (isPending) {
    return <div className="h-5 w-full animate-pulse rounded bg-white/15" />;
  }
  if (!data?.fields.length) {
    return (
      <p className="text-[10px] leading-snug text-white/50">
        This overlay has nothing to configure.
      </p>
    );
  }

  // Reset the draft whenever a different overlay's panel is shown, without an
  // effect: the loaded values are the baseline until something is edited.
  if (editing !== overlayId) {
    setEditing(overlayId);
    setDraft(null);
  }

  const values = draft ?? data.values;
  const dirty = draft !== null;

  const set = (key: string, value: OverlaySettingsValue) =>
    setDraft({ ...values, [key]: value });

  return (
    <div
      data-testid="overlay-settings"
      className="space-y-1.5 rounded bg-white/5 p-1.5"
    >
      {data.fields.map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(value) => set(field.key, value)}
        />
      ))}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          disabled={!dirty || save.isPending}
          onClick={() => {
            save.mutate(values, { onSuccess: () => setDraft(null) });
          }}
          className="rounded bg-white px-2 py-0.5 text-[10px] text-black hover:bg-white/85 disabled:opacity-40"
        >
          {save.isPending ? "Saving" : "Save"}
        </button>
        {dirty && (
          <button
            onClick={() => setDraft(null)}
            className="rounded bg-white/15 px-2 py-0.5 text-[10px] hover:bg-white/25"
          >
            Discard
          </button>
        )}
      </div>

      {/* A running browser source read its settings when it loaded. Saying so is
          cheaper than a streamer wondering why the stream did not change. */}
      <p className="text-[10px] leading-snug text-white/50">
        A saved change reaches the stream when the browser source reloads.
      </p>
    </div>
  );
}

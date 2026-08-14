"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";
import { useState } from "react";

// Drawn in the page rather than by the operating system, and committed when the
// picker settles rather than on every shade dragged through: the previous native
// input fired continuously, which meant a colour change recorded per shade.
export function ColourPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (colour: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Opening takes the current colour; closing is the settle, and records
        // one change whatever the drag passed through. Both are done here
        // rather than in an effect, which would set state during render.
        if (next) setDraft(value);
        else if (draft !== value) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-7 w-7 shrink-0 p-0.5"
          aria-label={label}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span
            className="h-full w-full rounded-sm border"
            style={{ background: draft }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <HexColorPicker color={draft} onChange={setDraft} />
        <p className="mt-2 text-center text-[11px] tabular-nums text-muted-foreground">
          {draft}
        </p>
      </PopoverContent>
    </Popover>
  );
}

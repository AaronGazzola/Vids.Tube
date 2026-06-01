"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Gauge } from "lucide-react";

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

type SpeedMenuProps = {
  value: number;
  onChange: (value: PlaybackSpeed) => void;
};

function formatSpeed(value: number) {
  return value === 1 ? "1x" : `${value}x`;
}

export function SpeedMenu({ value, onChange }: SpeedMenuProps) {
  const closest = PLAYBACK_SPEEDS.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Playback speed"
          className="h-8 gap-1 px-2 text-xs text-white hover:bg-white/15 hover:text-white"
        >
          <Gauge className="h-4 w-4" />
          <span>{formatSpeed(closest)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[6rem]">
        {PLAYBACK_SPEEDS.map((speed) => (
          <DropdownMenuItem
            key={speed}
            onSelect={() => onChange(speed)}
            className={cn(
              "justify-between text-xs",
              speed === closest && "font-semibold"
            )}
          >
            <span>{formatSpeed(speed)}</span>
            {speed === closest && <span aria-hidden>•</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";
import type { MediaLevel } from "./types";

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

type SettingsMenuProps = {
  showSpeed: boolean;
  playbackRate: number;
  onPlaybackRate: (value: PlaybackSpeed) => void;
  levels: MediaLevel[];
  activeLevel: number;
  onLevel: (index: number) => void;
};

function formatSpeed(value: number) {
  return value === 1 ? "1x" : `${value}x`;
}

function formatLevel(level: MediaLevel) {
  return level.height > 0
    ? `${level.height}p`
    : `${Math.round(level.bitrate / 1000)} kbps`;
}

export function SettingsMenu({
  showSpeed,
  playbackRate,
  onPlaybackRate,
  levels,
  activeLevel,
  onLevel,
}: SettingsMenuProps) {
  const closest = PLAYBACK_SPEEDS.reduce((best, candidate) =>
    Math.abs(candidate - playbackRate) < Math.abs(best - playbackRate)
      ? candidate
      : best
  );
  const showQuality = levels.length > 1;

  if (!showSpeed && !showQuality) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Settings"
          className="h-8 gap-1 px-2 text-xs text-white hover:bg-white/15 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          {showSpeed && <span>{formatSpeed(closest)}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {showSpeed && (
          <>
            <DropdownMenuLabel className="text-xs">Speed</DropdownMenuLabel>
            {PLAYBACK_SPEEDS.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onSelect={() => onPlaybackRate(speed)}
                className={cn(
                  "justify-between text-xs",
                  speed === closest && "font-semibold"
                )}
              >
                <span>{formatSpeed(speed)}</span>
                {speed === closest && <span aria-hidden>•</span>}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {showSpeed && showQuality && <DropdownMenuSeparator />}
        {showQuality && (
          <>
            <DropdownMenuLabel className="text-xs">Quality</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => onLevel(-1)}
              className={cn(
                "justify-between text-xs",
                activeLevel === -1 && "font-semibold"
              )}
            >
              <span>Auto</span>
              {activeLevel === -1 && <span aria-hidden>•</span>}
            </DropdownMenuItem>
            {levels.map((level) => (
              <DropdownMenuItem
                key={level.index}
                onSelect={() => onLevel(level.index)}
                className={cn(
                  "justify-between text-xs",
                  activeLevel === level.index && "font-semibold"
                )}
              >
                <span>{formatLevel(level)}</span>
                {activeLevel === level.index && <span aria-hidden>•</span>}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

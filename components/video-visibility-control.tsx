"use client";

import { useSetVideoVisibility } from "@/app/(app)/studio/layout.hooks";
import type { VideoVisibility } from "@/app/(app)/studio/layout.types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Link2 } from "lucide-react";

const OPTIONS: {
  value: VideoVisibility;
  label: string;
  reach: string;
}[] = [
  {
    value: "public",
    label: "Public",
    reach: "Listed on your channel, anyone can watch",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    reach: "Not listed, anyone with the link can watch",
  },
  { value: "private", label: "Private", reach: "Only you can watch" },
];

const ICONS = {
  public: Eye,
  unlisted: Link2,
  private: EyeOff,
} as const;

export function VideoVisibilityControl({
  videoId,
  visibility,
  className,
}: {
  videoId: string;
  visibility: VideoVisibility;
  className?: string;
}) {
  const { mutate, isPending } = useSetVideoVisibility();
  const current = OPTIONS.find((o) => o.value === visibility) ?? OPTIONS[0];
  const Icon = ICONS[current.value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={visibility === "public" ? "outline" : "secondary"}
          size="sm"
          disabled={isPending}
          className={cn("h-8 gap-1.5 text-xs", className)}
          aria-label={`Visibility: ${current.label}`}
        >
          <Icon className="size-3.5" aria-hidden />
          {current.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuRadioGroup
          value={visibility}
          onValueChange={(next) =>
            mutate({ videoId, visibility: next as VideoVisibility })
          }
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="items-start gap-2"
            >
              <span className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.reach}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

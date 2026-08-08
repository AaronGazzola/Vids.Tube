"use client";

import type { MembershipBadge } from "@/app/[channelSlug]/page.types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// A badge explains itself where it is shown, so nobody has to find a legend
// elsewhere to know what "Day One" means.
export function BadgeChip({
  badge,
  className,
}: {
  badge: MembershipBadge;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex cursor-default items-center rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className
          )}
        >
          {badge.title}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56">
        {badge.description}
      </TooltipContent>
    </Tooltip>
  );
}

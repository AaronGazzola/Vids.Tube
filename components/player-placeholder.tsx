import { cn } from "@/lib/utils";
import { Play, Radio } from "lucide-react";

export function PlayerPlaceholder({
  variant = "vod",
  className,
}: {
  variant?: "vod" | "live";
  className?: string;
}) {
  const Icon = variant === "live" ? Radio : Play;
  const label =
    variant === "live" ? "Live player coming soon" : "Player coming soon";

  return (
    <div
      className={cn(
        "flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <Icon className="h-10 w-10" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

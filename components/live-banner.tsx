import { Button } from "@/components/ui/button";
import { Radio } from "lucide-react";
import Link from "next/link";

export function LiveBanner({ isLive }: { isLive: boolean }) {
  if (!isLive) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Radio className="h-4 w-4" />
        Not live right now.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-red-500/40 bg-red-500/10 p-4">
      <div className="flex items-center gap-2 font-medium text-red-600 dark:text-red-400">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        Live now
      </div>
      <Button asChild size="sm">
        <Link href="/live">Watch</Link>
      </Button>
    </div>
  );
}

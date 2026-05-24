import { Radio } from "lucide-react";

export function OfflineCard() {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border bg-muted p-6 text-center">
      <Radio className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">No live stream right now</p>
        <p className="text-sm text-muted-foreground">
          Check back soon — the stream will appear here when it goes live.
        </p>
      </div>
    </div>
  );
}

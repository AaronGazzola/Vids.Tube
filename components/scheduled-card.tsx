import { CalendarClock } from "lucide-react";

export function ScheduledCard() {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/40 p-6 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">No stream scheduled right now</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          When this channel goes live, the stream and chat will appear here.
          In the meantime, browse the videos below.
        </p>
      </div>
    </div>
  );
}

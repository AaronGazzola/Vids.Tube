import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function NextStreamCard({
  nextStreamAt,
  latestVodId,
  thumbnailSeed,
}: {
  nextStreamAt: string;
  latestVodId: string;
  thumbnailSeed: string;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
      <Image
        src={`https://picsum.photos/seed/${thumbnailSeed}/1280/720`}
        alt=""
        fill
        priority
        className="scale-110 object-cover blur-xl"
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
        <span className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-white/80">
          <CalendarClock className="h-4 w-4" />
          Next stream
        </span>
        <p className="text-xl font-semibold md:text-2xl">{nextStreamAt}</p>
        <Button asChild size="lg">
          <Link href={`/watch/${latestVodId}`}>Watch latest VOD</Link>
        </Button>
      </div>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { ViewChart } from "@/components/view-chart";
import Image from "next/image";
import Link from "next/link";

export type StreamHistory = {
  id: string;
  title: string;
  date: string;
  thumbnailSeed: string;
  screenshotSeeds: string[];
  views: number[];
};

export function StreamHistoryItem({ stream }: { stream: StreamHistory }) {
  return (
    <Card className="gap-0 p-3">
      <div className="flex gap-2">
        <Link href={`/watch/${stream.id}`} className="shrink-0">
          <Image
            src={`https://picsum.photos/seed/${stream.thumbnailSeed}/480/270`}
            alt={stream.title}
            width={480}
            height={270}
            className="aspect-video h-24 w-auto rounded-md object-cover sm:h-28"
          />
        </Link>
        <div className="flex flex-1 gap-2 overflow-x-auto">
          {stream.screenshotSeeds.map((seed) => (
            <Image
              key={seed}
              src={`https://picsum.photos/seed/${seed}/320/180`}
              alt=""
              width={320}
              height={180}
              className="aspect-video h-24 w-auto shrink-0 rounded-md object-cover sm:h-28"
            />
          ))}
        </div>
      </div>
      <ViewChart data={stream.views} className="mt-3 h-10 w-full" />
      <div className="mt-2">
        <p className="font-medium">{stream.title}</p>
        <p className="text-sm text-muted-foreground">{stream.date}</p>
      </div>
    </Card>
  );
}

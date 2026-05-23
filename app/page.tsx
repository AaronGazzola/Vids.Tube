import { LiveChatPlaceholder } from "@/components/live-chat-placeholder";
import { NextStreamCard } from "@/components/next-stream-card";
import {
  StreamHistoryItem,
  type StreamHistory,
} from "@/components/stream-history-item";

const nextStreamAt = "Saturday, May 31 · 7:00 PM";

const streams: StreamHistory[] = Array.from({ length: 4 }, (_, i) => ({
  id: `stream-${i + 1}`,
  title: `Stream session ${i + 1}`,
  date: `${["May 17", "May 10", "May 3", "Apr 26"][i]} · 2h 14m`,
  thumbnailSeed: `vt-thumb-${i + 1}`,
  screenshotSeeds: Array.from(
    { length: 8 },
    (_, j) => `vt-shot-${i + 1}-${j + 1}`
  ),
  views: Array.from({ length: 16 }, (_, j) =>
    Math.round(30 + 55 * Math.abs(Math.sin(j / 3 + i)) + j)
  ),
}));

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <NextStreamCard
          nextStreamAt={nextStreamAt}
          latestVodId="stream-1"
          thumbnailSeed="vt-thumb-1"
        />
        <div className="lg:h-auto">
          <LiveChatPlaceholder />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Past streams</h2>
        <div className="flex flex-col gap-4">
          {streams.map((stream) => (
            <StreamHistoryItem key={stream.id} stream={stream} />
          ))}
        </div>
      </section>
    </main>
  );
}

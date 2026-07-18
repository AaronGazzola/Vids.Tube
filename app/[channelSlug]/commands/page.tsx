"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";
import { useChannelCommands } from "./page.hooks";

function cadenceLabel(cooldownS: number, maxPerStream: number | null): string {
  const parts: string[] = [];
  if (cooldownS > 0) {
    parts.push(`every ${cooldownS}s`);
  }
  if (maxPerStream != null) {
    parts.push(`${maxPerStream} per stream`);
  }
  return parts.join(" · ");
}

export default function ChannelCommandsPage() {
  const params = useParams<{ channelSlug: string }>();
  const { data, isPending } = useChannelCommands(params.channelSlug);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
      <h1 className="text-2xl font-bold tracking-tight">Chat commands</h1>
      {isPending ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !data ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Channel not found.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Type these in {data.handle ? `@${data.handle}` : data.channelName}
            &apos;s live chat — on Vids.Tube or YouTube — while a stream is
            running.
          </p>
          {data.commands.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No commands are enabled right now.
            </p>
          ) : (
            <ul className="mt-6 divide-y rounded-lg border">
              {data.commands.map((c) => (
                <li
                  key={c.keyword}
                  className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <code className="shrink-0 rounded bg-muted px-2 py-1 font-mono text-sm font-semibold">
                    !{c.keyword}
                  </code>
                  <span className="flex-1 text-sm">{c.description}</span>
                  {cadenceLabel(c.cooldown_s, c.max_per_stream) && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {cadenceLabel(c.cooldown_s, c.max_per_stream)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

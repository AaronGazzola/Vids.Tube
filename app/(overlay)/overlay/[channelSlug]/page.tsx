"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { computeStandings } from "@/lib/standings";
import { use, useState } from "react";
import { useFeaturedMessages, useStreamStandings } from "./page.hooks";

export default function OverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const { data: channel } = useChannel(channelSlug);
  const { data: stream } = useLiveStream(channel?.id);

  const streamId = stream?.status === "live" ? stream.id : null;
  const { data: featured } = useFeaturedMessages(streamId);
  const { data: standings } = useStreamStandings(streamId);

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const current = streamId
    ? featured?.find((m) => !doneIds.has(m.id)) ?? null
    : null;

  if (!current) return null;

  const standingMap = computeStandings(
    (standings ?? []).map((s) => ({ id: s.participant_key, score: s.total_score }))
  );
  const participantKey =
    current.user_id ?? `${current.origin}:${current.external_author_id}`;
  const standing = standingMap.get(participantKey) ?? { rank: 99, progress: 0 };

  return (
    <HighlightedMessage
      key={current.id}
      author={current.author}
      text={current.body ?? ""}
      rank={standing.rank}
      progress={standing.progress}
      onDone={() =>
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.add(current.id);
          return next;
        })
      }
    />
  );
}

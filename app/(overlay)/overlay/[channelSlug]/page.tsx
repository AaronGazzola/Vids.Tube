"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { computeStandings } from "@/lib/standings";
import { useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { usePromotedMessages, useStreamStandings } from "./page.hooks";

export default function OverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const sp = useSearchParams();
  const width = Number(sp.get("width")) || 420;
  const { data: channel } = useChannel(channelSlug);
  const { data: stream } = useLiveStream(channel?.id);

  const streamId = stream?.status === "live" ? stream.id : null;
  const { data: promoted } = usePromotedMessages(streamId);
  const { data: standings } = useStreamStandings(streamId);

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const current = streamId
    ? promoted?.find((m) => !doneIds.has(m.id)) ?? null
    : null;

  if (!current) return null;

  const standingMap = computeStandings(
    (standings ?? []).map((s) => ({ id: s.participant_key, score: s.total_score }))
  );
  const participantKey =
    current.user_id ?? `${current.origin}:${current.external_author_id}`;
  const standing = standingMap.get(participantKey) ?? { rank: 99, progress: 0 };

  return (
    <div style={{ width }}>
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
    </div>
  );
}

"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { computeStandings } from "@/lib/standings";
import { Volume2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { use, useState } from "react";
import { markTtsPlayedAction } from "./page.actions";
import {
  usePlayableTts,
  usePromotedMessages,
  useStreamStandings,
} from "./page.hooks";

function ttsAudioUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tts/${path}`;
}

function TtsPlayer({ streamId }: { streamId: string | null }) {
  const { data: queue } = usePlayableTts(streamId);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const current = (queue ?? []).find((t) => !doneIds.has(t.id)) ?? null;
  if (!current) return null;

  const finish = () => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.add(current.id);
      return next;
    });
    markTtsPlayedAction(current.id).catch((e) => console.error(e));
  };

  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur">
      <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
      <div className="min-w-0">
        {current.authorName && (
          <p className="text-xs font-semibold text-indigo-300">
            {current.authorName.replace(/^@+/, "")}
          </p>
        )}
        <p className="text-sm leading-snug">{current.text}</p>
      </div>
      <audio
        key={current.id}
        src={ttsAudioUrl(current.audioPath)}
        autoPlay
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
}

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

  const standingMap = computeStandings(
    (standings ?? []).map((s) => ({ id: s.participant_key, score: s.total_score }))
  );
  const participantKey = current
    ? current.user_id ?? `${current.origin}:${current.external_author_id}`
    : null;
  const standing =
    (participantKey ? standingMap.get(participantKey) : null) ?? {
      rank: 99,
      progress: 0,
    };

  return (
    <div style={{ width }}>
      {current && (
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
      )}
      <TtsPlayer streamId={streamId} />
    </div>
  );
}

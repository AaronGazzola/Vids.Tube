"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { computeStandings } from "@/lib/standings";
import { Bot, MessageCircleQuestion } from "lucide-react";
import { Volume2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { markAskShownAction, markTtsPlayedAction } from "./page.actions";
import {
  usePlayableAsk,
  usePlayableTts,
  usePromotedMessages,
  useStreamStandings,
} from "./page.hooks";

const ASK_HOLD_MS = 10_000;

function AskExchange({ streamId }: { streamId: string | null }) {
  const { data: queue } = usePlayableAsk(streamId);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const current = (queue ?? []).find((a) => !doneIds.has(a.id)) ?? null;
  const currentId = current?.id ?? null;

  useEffect(() => {
    if (!currentId) return;
    const timer = setTimeout(() => {
      setDoneIds((prev) => {
        const next = new Set(prev);
        next.add(currentId);
        return next;
      });
      markAskShownAction(currentId).catch((e) => console.error(e));
    }, ASK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  if (!current) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-start gap-2 rounded-xl bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur">
        <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          {current.authorName && (
            <p className="text-xs font-semibold text-amber-300">
              {current.authorName.replace(/^@+/, "")}
            </p>
          )}
          <p className="text-sm leading-snug">{current.question}</p>
        </div>
      </div>
      {current.includeAnswer && current.answer && (
        <div className="ml-8 flex flex-row-reverse items-start gap-2 rounded-xl bg-indigo-950/90 px-4 py-3 text-white shadow-lg backdrop-blur">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-xs font-semibold text-indigo-300">VidsBot</p>
            <p className="text-sm leading-snug">{current.answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

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
      <AskExchange streamId={streamId} />
    </div>
  );
}

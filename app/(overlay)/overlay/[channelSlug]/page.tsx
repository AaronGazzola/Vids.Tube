"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { AskExchangeView } from "@/components/overlay/ask-exchange";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { TtsCard } from "@/components/overlay/tts-card";
import { computeStandings } from "@/lib/standings";
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

function ttsAudioUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tts/${path}`;
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
  const { data: ttsQueue } = usePlayableTts(streamId);
  const { data: askQueue } = usePlayableAsk(streamId);

  const [doneHighlights, setDoneHighlights] = useState<Set<string>>(new Set());
  const [doneTts, setDoneTts] = useState<Set<string>>(new Set());
  const [doneAsks, setDoneAsks] = useState<Set<string>>(new Set());

  // One shared slot: the highlight, TTS card, and ask exchange never render
  // together — each waits until the slot is free.
  const currentHighlight = streamId
    ? promoted?.find((m) => !doneHighlights.has(m.id)) ?? null
    : null;
  const currentTts = currentHighlight
    ? null
    : (ttsQueue ?? []).find((t) => !doneTts.has(t.id)) ?? null;
  const currentAsk =
    currentHighlight || currentTts
      ? null
      : (askQueue ?? []).find((a) => !doneAsks.has(a.id)) ?? null;
  const currentAskId = currentAsk?.id ?? null;

  useEffect(() => {
    if (!currentAskId) return;
    const timer = setTimeout(() => {
      setDoneAsks((prev) => {
        const next = new Set(prev);
        next.add(currentAskId);
        return next;
      });
      markAskShownAction(currentAskId).catch((e) => console.error(e));
    }, ASK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentAskId]);

  const standingMap = computeStandings(
    (standings ?? []).map((s) => ({ id: s.participant_key, score: s.total_score }))
  );
  const standingFor = (key: string | null) =>
    (key ? standingMap.get(key) : null) ?? { rank: 99, progress: 0 };

  const highlightStanding = standingFor(
    currentHighlight
      ? currentHighlight.user_id ??
          `${currentHighlight.origin}:${currentHighlight.external_author_id}`
      : null
  );
  const ttsStanding = standingFor(currentTts?.participantKey ?? null);
  const askStanding = standingFor(currentAsk?.participantKey ?? null);

  return (
    <div style={{ width }}>
      {currentHighlight && (
        <HighlightedMessage
          key={currentHighlight.id}
          author={currentHighlight.author}
          text={currentHighlight.body ?? ""}
          rank={highlightStanding.rank}
          progress={highlightStanding.progress}
          onDone={() =>
            setDoneHighlights((prev) => {
              const next = new Set(prev);
              next.add(currentHighlight.id);
              return next;
            })
          }
        />
      )}
      {currentTts && (
        <TtsCard
          key={currentTts.id}
          author={currentTts.author}
          rank={ttsStanding.rank}
          progress={ttsStanding.progress}
          text={currentTts.text}
          audioSrc={ttsAudioUrl(currentTts.audioPath)}
          audioKey={currentTts.id}
          onDone={() => {
            setDoneTts((prev) => {
              const next = new Set(prev);
              next.add(currentTts.id);
              return next;
            });
            markTtsPlayedAction(currentTts.id).catch((e) => console.error(e));
          }}
        />
      )}
      {currentAsk && (
        <AskExchangeView
          key={currentAsk.id}
          author={currentAsk.author}
          rank={askStanding.rank}
          progress={askStanding.progress}
          question={currentAsk.question}
          answer={currentAsk.answer}
          includeAnswer={currentAsk.includeAnswer}
        />
      )}
    </div>
  );
}

"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { AskExchangeView } from "@/components/overlay/ask-exchange";
import { OverlayBoxFrame } from "@/components/overlay/box-frame";
import { OverlayEmptyState } from "@/components/overlay/empty-placeholder";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { TtsCard } from "@/components/overlay/tts-card";
import {
  DEMO_TTS_SAMPLE_SRC,
  OVERLAY_FEED_WIDTH,
  type DemoOverlaySnapshot,
} from "@/lib/demo-overlay";
import { computeStandings } from "@/lib/standings";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import {
  markAskShownAction,
  markHighlightShownAction,
  markTtsPlayedAction,
  type PlayableTts,
} from "./page.actions";
import {
  useDemoOverlaySnapshot,
  useOverlayChime,
  useOverlayLayout,
  usePlayableAsk,
  usePlayableTts,
  usePromotedMessages,
  useStreamStandings,
} from "./page.hooks";

const ASK_HOLD_MS = 10_000;

function ttsAudioUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tts/${path}`;
}

// Re-approving a request stamps a fresh approved_at, so a replayed message gets a
// new key and isn't filtered out as already played.
function ttsPlayKey(t: PlayableTts): string {
  return `${t.id}:${t.approvedAt ?? ""}`;
}

function DemoOverlayFeed({ snapshot }: { snapshot: DemoOverlaySnapshot }) {
  const [doneHighlights, setDoneHighlights] = useState<Set<string>>(new Set());
  const [doneTts, setDoneTts] = useState<Set<string>>(new Set());
  const [doneAsks, setDoneAsks] = useState<Set<string>>(new Set());

  const currentHighlight = snapshot.visible.highlight
    ? snapshot.highlights.find((h) => !doneHighlights.has(h.id)) ?? null
    : null;
  const currentTts =
    !currentHighlight && snapshot.visible.tts
      ? snapshot.tts.find((t) => !doneTts.has(t.id)) ?? null
      : null;
  const currentAsk =
    !currentHighlight && !currentTts && snapshot.visible.ask
      ? snapshot.asks.find((a) => !doneAsks.has(a.id)) ?? null
      : null;
  const currentAskId = currentAsk?.id ?? null;
  const persistAsk = snapshot.persist.ask;

  useOverlayChime(
    currentHighlight
      ? `highlight:${currentHighlight.id}`
      : currentTts
        ? `tts:${currentTts.id}`
        : currentAskId
          ? `ask:${currentAskId}`
          : null
  );

  useEffect(() => {
    if (!currentAskId || persistAsk) return;
    const timer = setTimeout(() => {
      setDoneAsks((prev) => {
        const next = new Set(prev);
        next.add(currentAskId);
        return next;
      });
    }, ASK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentAskId, persistAsk]);

  return (
    <>
      {currentHighlight && (
        <HighlightedMessage
          key={currentHighlight.id}
          author={currentHighlight.author}
          text={currentHighlight.text}
          rank={currentHighlight.rank}
          progress={currentHighlight.progress}
          persist={snapshot.persist.highlight}
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
          rank={currentTts.rank}
          progress={currentTts.progress}
          text={currentTts.text}
          audioSrc={DEMO_TTS_SAMPLE_SRC}
          audioKey={currentTts.id}
          onDone={() => {
            if (snapshot.persist.tts) return;
            setDoneTts((prev) => {
              const next = new Set(prev);
              next.add(currentTts.id);
              return next;
            });
          }}
        />
      )}
      {currentAsk && (
        <AskExchangeView
          key={currentAsk.id}
          author={currentAsk.author}
          rank={currentAsk.rank}
          progress={currentAsk.progress}
          question={currentAsk.question}
          answer={currentAsk.answer}
          includeAnswer={currentAsk.includeAnswer}
        />
      )}
    </>
  );
}

export default function OverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const sp = useSearchParams();
  const width = Number(sp.get("width")) || OVERLAY_FEED_WIDTH;
  const demo = useDemoOverlaySnapshot(channelSlug);
  const { data: layout } = useOverlayLayout(channelSlug);
  const { data: channel } = useChannel(channelSlug);
  const streamQuery = useLiveStream(channel?.id);
  const stream = streamQuery.data;

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
    : (ttsQueue ?? []).find((t) => !doneTts.has(ttsPlayKey(t))) ?? null;
  const currentAsk =
    currentHighlight || currentTts
      ? null
      : (askQueue ?? []).find((a) => !doneAsks.has(a.id)) ?? null;
  const currentAskId = demo ? null : currentAsk?.id ?? null;

  useOverlayChime(
    demo
      ? null
      : currentHighlight
        ? `highlight:${currentHighlight.id}`
        : currentTts
          ? `tts:${ttsPlayKey(currentTts)}`
          : currentAsk
            ? `ask:${currentAsk.id}`
            : null
  );

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

  if (demo) {
    return (
      <OverlayBoxFrame
        scale={demo.boxes.highlight.scale}
        width={OVERLAY_FEED_WIDTH}
      >
        <DemoOverlayFeed snapshot={demo} />
      </OverlayBoxFrame>
    );
  }

  // Offline: show a placeholder at the saved scale so the source can be
  // positioned in OBS. Once live, an empty slot stays invisible.
  if (streamQuery.isSuccess && !streamId) {
    return (
      <OverlayBoxFrame
        scale={layout?.boxes.highlight.scale ?? 1}
        width={OVERLAY_FEED_WIDTH}
      >
        <OverlayEmptyState
          label="Highlights"
          width={OVERLAY_FEED_WIDTH}
          height={380}
        />
      </OverlayBoxFrame>
    );
  }

  const highlightStanding = standingFor(
    currentHighlight
      ? currentHighlight.user_id ??
          `${currentHighlight.origin}:${currentHighlight.external_author_id}`
      : null
  );
  const ttsStanding = standingFor(currentTts?.participantKey ?? null);
  const askStanding = standingFor(currentAsk?.participantKey ?? null);

  const feed = (
    <>
      {currentHighlight && (
        <HighlightedMessage
          key={currentHighlight.id}
          author={currentHighlight.author}
          text={currentHighlight.body ?? ""}
          rank={highlightStanding.rank}
          progress={highlightStanding.progress}
          onDone={() => {
            setDoneHighlights((prev) => {
              const next = new Set(prev);
              next.add(currentHighlight.id);
              return next;
            });
            markHighlightShownAction(currentHighlight.id).catch((e) =>
              console.error(e)
            );
          }}
        />
      )}
      {currentTts && (
        <TtsCard
          key={ttsPlayKey(currentTts)}
          author={currentTts.author}
          rank={ttsStanding.rank}
          progress={ttsStanding.progress}
          text={currentTts.text}
          audioSrc={ttsAudioUrl(currentTts.audioPath)}
          audioKey={ttsPlayKey(currentTts)}
          onDone={() => {
            setDoneTts((prev) => {
              const next = new Set(prev);
              next.add(ttsPlayKey(currentTts));
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
    </>
  );

  if (layout) {
    return (
      <OverlayBoxFrame
        scale={layout.boxes.highlight.scale}
        width={OVERLAY_FEED_WIDTH}
      >
        {feed}
      </OverlayBoxFrame>
    );
  }

  return <div style={{ width }}>{feed}</div>;
}

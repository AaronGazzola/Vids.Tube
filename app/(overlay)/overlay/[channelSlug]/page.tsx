"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import type { GoalMetric } from "@/app/layout.types";
import { AskExchangeView } from "@/components/overlay/ask-exchange";
import { BreakCard } from "@/components/overlay/break-card";
import { OverlayStage } from "@/components/overlay/overlay-stage";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { TtsCard } from "@/components/overlay/tts-card";
import type { DemoLayoutConfig } from "@/app/(app)/live/demo.types";
import {
  DEMO_TTS_SAMPLE_SRC,
  OVERLAY_LADDER_MAX,
  type DemoOverlaySnapshot,
} from "@/lib/demo-overlay";
import { resolveBannerMetrics } from "@/lib/banner-metrics";
import { DEFAULT_GOALS, idleProgress } from "@/lib/goals";
import { computeStandings } from "@/lib/standings";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useBreakState } from "./break/page.hooks";
import { useCompetition } from "./competition/page.hooks";
import { useGoalProgress } from "./goals/page.hooks";
import {
  markAskShownAction,
  markHighlightShownAction,
  markTtsPlayedAction,
  type PlayableTts,
} from "./page.actions";
import {
  useDemoOverlaySnapshot,
  useInstalledOverlay,
  useLiveOverlayLayout,
  useOverlayEvents,
  useBannerCounts,
  useMemberCount,
  useOverlayChime,
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

// Re-highlighting a message stamps a fresh promoted_at (and clears shown_at), so a
// replayed highlight gets a new key and isn't filtered out as already shown — this
// is what lets the owner click Highlight again to replay it on this same overlay.
function highlightShowKey(m: { id: string; promoted_at: string | null }): string {
  return `${m.id}:${m.promoted_at ?? ""}`;
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

function LiveFeedSlot({
  streamId,
  soundOn,
}: {
  streamId: string;
  soundOn: boolean;
}) {
  const { data: promoted } = usePromotedMessages(streamId);
  const { data: standings } = useStreamStandings(streamId);
  const { data: ttsQueue } = usePlayableTts(streamId);
  const { data: askQueue } = usePlayableAsk(streamId);

  const [doneHighlights, setDoneHighlights] = useState<Set<string>>(new Set());
  const [doneTts, setDoneTts] = useState<Set<string>>(new Set());
  const [doneAsks, setDoneAsks] = useState<Set<string>>(new Set());

  // One shared slot: the highlight, TTS card, and ask exchange never render
  // together — each waits until the slot is free.
  const currentHighlight =
    promoted?.find((m) => !doneHighlights.has(highlightShowKey(m))) ?? null;
  const currentTts = currentHighlight
    ? null
    : (ttsQueue ?? []).find((t) => !doneTts.has(ttsPlayKey(t))) ?? null;
  const currentAsk =
    currentHighlight || currentTts
      ? null
      : (askQueue ?? []).find((a) => !doneAsks.has(a.id)) ?? null;
  const currentAskId = currentAsk?.id ?? null;

  useOverlayChime(
    !soundOn
      ? null
      : currentHighlight
        ? `highlight:${highlightShowKey(currentHighlight)}`
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
    (standings ?? []).map((s) => ({
      id: s.participant_key,
      score: s.total_score,
    }))
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
    <>
      {currentHighlight && (
        <HighlightedMessage
          key={highlightShowKey(currentHighlight)}
          author={currentHighlight.author}
          text={currentHighlight.body ?? ""}
          rank={highlightStanding.rank}
          progress={highlightStanding.progress}
          onDone={() => {
            setDoneHighlights((prev) => {
              const next = new Set(prev);
              next.add(highlightShowKey(currentHighlight));
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
}

function DemoBreak() {
  const DEMO_BREAK_MS = 5 * 60_000;
  const [endsAt, setEndsAt] = useState(() => Date.now() + DEMO_BREAK_MS);
  return (
    <BreakCard
      endsAt={endsAt}
      onDone={() => setEndsAt(Date.now() + DEMO_BREAK_MS)}
    />
  );
}

// The single overlay frame: one 1080x1920 OBS browser source rendering every
// enabled element at its saved position/scale. Gated by the channel's overlay
// token; layout edits arrive live over the layout broadcast channel.
export default function OverlayFramePage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";

  const layout = useLiveOverlayLayout(channelSlug, token);
  const installation = useInstalledOverlay(channelSlug, token);
  const gameEvents = useOverlayEvents(installation.data?.token ?? null);
  const demo = useDemoOverlaySnapshot(channelSlug);
  const { data: channel } = useChannel(channelSlug);
  const streamQuery = useLiveStream(channel?.id);
  const stream = streamQuery.data;
  const streamId = stream?.status === "live" ? stream.id : null;

  const { data: goalData } = useGoalProgress(channelSlug, 10, !demo);
  const { data: scores } = useCompetition(channelSlug, 5);
  const breakQuery = useBreakState(channelSlug);
  const { data: memberCount } = useMemberCount(channelSlug);
  const { data: bannerCounts } = useBannerCounts(channelSlug);

  if (!layout.isSuccess || !layout.config) {
    return null;
  }
  const config: DemoLayoutConfig = layout.config;

  const boxes = demo ? demo.boxes : config.boxes;
  const visible = demo ? demo.visible : config.visible;

  const feedVisible = demo
    ? demo.visible.highlight || demo.visible.tts || demo.visible.ask
    : config.visible.highlight ||
      config.visible.tts ||
      config.visible.ask;

  const goalMetric = (m: GoalMetric) => {
    if (demo) {
      return demo.metrics[m];
    }
    if (goalData?.active && goalData.metrics) {
      return goalData.metrics[m];
    }
    if (goalData && !goalData.isLive) {
      return idleProgress(goalData.targets?.[m] ?? DEFAULT_GOALS[m]);
    }
    return null;
  };

  const competitionEntries = demo
    ? demo.competition.slice(0, OVERLAY_LADDER_MAX)
    : (scores ?? [])
        .filter((s) => s.total_score > 0)
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, OVERLAY_LADDER_MAX)
        .map((s) => ({
          key: s.participant_key,
          author: s.author,
          score: s.total_score,
        }));

  const breakEndsAt = breakQuery.data?.breakEndsAt ?? null;

  const feedSlot = demo ? (
    <DemoOverlayFeed snapshot={demo} />
  ) : streamId ? (
    <LiveFeedSlot streamId={streamId} soundOn={config.feedSound !== "off"} />
  ) : null;

  const breakSlot = demo
    ? visible.break
      ? <DemoBreak />
      : null
    : breakEndsAt
      ? <BreakCard key={breakEndsAt} endsAt={breakEndsAt} />
      : null;

  return (
    <OverlayStage
      config={config}
      boxes={boxes}
      visible={visible}
      surface="obs"
      values={{
        feedVisible,
        feedSlot,
        feedSlotFilled: true,
        bannerMetrics: resolveBannerMetrics({
          goals: goalData,
          memberCount,
          chattersThisStream: bannerCounts?.chattersThisStream,
          chatsThisStream: bannerCounts?.chatsThisStream,
          commandsThisStream: bannerCounts?.commandsThisStream,
          newMembersThisStream: bannerCounts?.newMembersThisStream,
        }),
        goalMetric,
        competitionEntries,
        breakSlot,
        gameInstallation: installation.data,
        gameEvents,
      }}
    />
  );
}

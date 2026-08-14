"use client";

import type { FeaturedAuthor, GoalMetric } from "@/app/layout.types";
import { AskExchangeView } from "@/components/overlay/ask-exchange";
import { BreakCard } from "@/components/overlay/break-card";
import type { CompetitionEntry } from "@/components/overlay/competition-ladder";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import type { OverlayStageValues } from "@/components/overlay/overlay-stage.types";
import { TtsCard } from "@/components/overlay/tts-card";
import { OVERLAY_LADDER_MAX } from "@/lib/demo-overlay";
import { computeGoalProgress, reachedProgress, type Counts } from "@/lib/goals";
import { computeStandings } from "@/lib/standings";
import { useEffect, useState } from "react";
import {
  useDemoGeneratorStore,
  useDemoLayoutStore,
  type DemoViewer,
} from "./demo.stores";
import { DEMO_GOAL_TARGETS, DEMO_MEMBER_COUNT } from "./demo.types";

const DEMO_BREAK_MS = 5 * 60_000;
const DEMO_ASK_HOLD_MS = 10_000;

function authorOf(v: DemoViewer): FeaturedAuthor {
  return {
    name: v.name,
    handle: v.handle,
    avatarUrl: v.avatarUrl,
    avatarPath: null,
  };
}

function DemoBreak() {
  const [endsAt, setEndsAt] = useState(() => Date.now() + DEMO_BREAK_MS);
  return (
    <BreakCard
      endsAt={endsAt}
      onDone={() => setEndsAt(Date.now() + DEMO_BREAK_MS)}
    />
  );
}

function DemoOverlayFeed() {
  const config = useDemoLayoutStore((s) => s.config);
  const persist = useDemoLayoutStore((s) => s.persist);
  const messages = useDemoGeneratorStore((s) => s.messages);
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const scores = useDemoGeneratorStore((s) => s.scores);
  const tts = useDemoGeneratorStore((s) => s.tts);
  const asks = useDemoGeneratorStore((s) => s.asks);
  const markTtsPlayed = useDemoGeneratorStore((s) => s.markTtsPlayed);
  const markAskShown = useDemoGeneratorStore((s) => s.markAskShown);
  const [doneHighlights, setDoneHighlights] = useState<Set<string>>(new Set());
  const [finishedTts, setFinishedTts] = useState<Set<string>>(new Set());

  const currentHighlight = config.visible.highlight
    ? [...messages]
        .reverse()
        .find((m) => m.promoted && !m.dismissed && !doneHighlights.has(m.id)) ??
      null
    : null;
  const currentTts =
    !currentHighlight && config.visible.tts
      ? tts.find((t) => t.status === "approved") ?? null
      : null;
  const currentAsk =
    !currentHighlight && !currentTts && config.visible.ask
      ? asks.find((a) => a.status === "approved") ?? null
      : null;
  const currentTtsId = currentTts?.id ?? null;
  const currentAskId = currentAsk?.id ?? null;

  useEffect(() => {
    if (!currentAskId || persist.ask) return;
    const timer = setTimeout(
      () => markAskShown(currentAskId),
      DEMO_ASK_HOLD_MS
    );
    return () => clearTimeout(timer);
  }, [currentAskId, persist.ask, markAskShown]);

  useEffect(() => {
    if (!persist.tts && currentTtsId && finishedTts.has(currentTtsId)) {
      markTtsPlayed(currentTtsId);
    }
  }, [persist.tts, currentTtsId, finishedTts, markTtsPlayed]);

  const active = viewers
    .map((v) => ({ id: v.key, score: scores[v.key]?.total ?? 0 }))
    .filter((x) => x.score > 0);
  const standingMap = computeStandings(active);
  const standingFor = (key: string) =>
    standingMap.get(key) ?? { rank: 99, progress: 0 };
  const authorFor = (key: string) => {
    const viewer = viewers.find((v) => v.key === key);
    return viewer ? authorOf(viewer) : null;
  };

  if (currentHighlight) {
    return (
      <HighlightedMessage
        key={currentHighlight.id}
        author={authorFor(currentHighlight.viewerKey)}
        text={currentHighlight.text}
        rank={standingFor(currentHighlight.viewerKey).rank}
        progress={standingFor(currentHighlight.viewerKey).progress}
        persist={persist.highlight}
        onDone={() =>
          setDoneHighlights((prev) => {
            const next = new Set(prev);
            next.add(currentHighlight.id);
            return next;
          })
        }
      />
    );
  }

  if (currentTts) {
    return (
      <TtsCard
        key={currentTts.id}
        author={authorFor(currentTts.viewerKey)}
        rank={standingFor(currentTts.viewerKey).rank}
        progress={standingFor(currentTts.viewerKey).progress}
        text={currentTts.text}
        audioSrc="/demo/tts-sample.mp3"
        audioKey={currentTts.id}
        onDone={() => {
          if (persist.tts) {
            setFinishedTts((prev) => {
              const next = new Set(prev);
              next.add(currentTts.id);
              return next;
            });
          } else {
            markTtsPlayed(currentTts.id);
          }
        }}
      />
    );
  }

  if (currentAsk) {
    return (
      <AskExchangeView
        key={currentAsk.id}
        author={authorFor(currentAsk.viewerKey)}
        rank={standingFor(currentAsk.viewerKey).rank}
        progress={standingFor(currentAsk.viewerKey).progress}
        question={currentAsk.question}
        answer={currentAsk.answer}
        includeAnswer={currentAsk.includeAnswer}
      />
    );
  }

  return null;
}

export function useOverlayDemoValues(
  goals: Counts | null,
  feedVisible: boolean
): OverlayStageValues {
  const config = useDemoLayoutStore((s) => s.config);
  const counts = useDemoGeneratorStore((s) => s.counts);
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const scores = useDemoGeneratorStore((s) => s.scores);
  const messages = useDemoGeneratorStore((s) => s.messages);
  const tts = useDemoGeneratorStore((s) => s.tts);
  const asks = useDemoGeneratorStore((s) => s.asks);

  const targets = goals ?? DEMO_GOAL_TARGETS;
  const progress = computeGoalProgress(counts, null, targets as Counts);

  const goalMetric = (metric: GoalMetric) =>
    config.goalProgressFull ? reachedProgress(progress[metric]) : progress[metric];

  const competitionEntries: CompetitionEntry[] = viewers
    .map((v) => ({
      key: v.key,
      author: authorOf(v),
      score: scores[v.key]?.total ?? 0,
    }))
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, OVERLAY_LADDER_MAX);

  const feedSlotFilled = Boolean(
    (config.visible.highlight &&
      messages.some((m) => m.promoted && !m.dismissed)) ||
      (config.visible.tts && tts.some((t) => t.status === "approved")) ||
      (config.visible.ask && asks.some((a) => a.status === "approved"))
  );

  return {
    feedVisible,
    feedSlot: <DemoOverlayFeed />,
    feedSlotFilled,
    bannerMetrics: {
      totalSubs: 4820,
      newSubsThisStream: 37,
      likesThisStream: 214,
      currentViewers: 63,
      totalChatters: 512,
      totalCommands: 1840,
      members: DEMO_MEMBER_COUNT,
      newMembersThisStream: 9,
    },
    goalMetric,
    competitionEntries,
    breakSlot: config.visible.break ? <DemoBreak /> : null,
  };
}

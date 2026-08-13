"use client";

import { useBreakState } from "@/app/(overlay)/overlay/[channelSlug]/break/page.hooks";
import { useCompetition } from "@/app/(overlay)/overlay/[channelSlug]/competition/page.hooks";
import { useGoalProgress } from "@/app/(overlay)/overlay/[channelSlug]/goals/page.hooks";
import {
  useMemberCount,
  usePlayableAsk,
  usePlayableTts,
  usePromotedMessages,
  useStreamStandings,
} from "@/app/(overlay)/overlay/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import type { GoalMetric } from "@/app/layout.types";
import { AskExchangeView } from "@/components/overlay/ask-exchange";
import { BreakCard } from "@/components/overlay/break-card";
import type { CompetitionEntry } from "@/components/overlay/competition-ladder";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import type { OverlayStageValues } from "@/components/overlay/overlay-stage.types";
import { TtsCard } from "@/components/overlay/tts-card";
import { OVERLAY_LADDER_MAX } from "@/lib/demo-overlay";
import { DEFAULT_GOALS, idleProgress, type Counts } from "@/lib/goals";
import { computeStandings } from "@/lib/standings";
import { useChannel } from "@/app/[channelSlug]/page.hooks";

// The composer shows what viewers are seeing, so it must never consume it: the
// OBS route marks a highlight shown and a TTS played as it renders them, and
// doing that here would burn a real item just because the owner opened a tab.
// Nothing in this slot reports back.
function ComposerFeedSlot({ streamId }: { streamId: string }) {
  const { data: promoted } = usePromotedMessages(streamId);
  const { data: standings } = useStreamStandings(streamId);
  const { data: ttsQueue } = usePlayableTts(streamId);
  const { data: askQueue } = usePlayableAsk(streamId);

  const currentHighlight = promoted?.[0] ?? null;
  const currentTts = currentHighlight ? null : ttsQueue?.[0] ?? null;
  const currentAsk = currentHighlight || currentTts ? null : askQueue?.[0] ?? null;

  const standingMap = computeStandings(
    (standings ?? []).map((s) => ({
      id: s.participant_key,
      score: s.total_score,
    }))
  );
  const standingFor = (key: string | null) =>
    (key ? standingMap.get(key) : null) ?? { rank: 99, progress: 0 };

  if (currentHighlight) {
    const standing = standingFor(
      currentHighlight.user_id ??
        `${currentHighlight.origin}:${currentHighlight.external_author_id}`
    );
    return (
      <HighlightedMessage
        author={currentHighlight.author}
        text={currentHighlight.body ?? ""}
        rank={standing.rank}
        progress={standing.progress}
        persist
        onDone={() => {}}
      />
    );
  }

  if (currentTts) {
    const standing = standingFor(currentTts.participantKey ?? null);
    return (
      <TtsCard
        author={currentTts.author}
        rank={standing.rank}
        progress={standing.progress}
        text={currentTts.text}
        audioSrc={null}
        audioKey={currentTts.id}
        onDone={() => {}}
      />
    );
  }

  if (currentAsk) {
    const standing = standingFor(currentAsk.participantKey ?? null);
    return (
      <AskExchangeView
        author={currentAsk.author}
        rank={standing.rank}
        progress={standing.progress}
        question={currentAsk.question}
        answer={currentAsk.answer}
        includeAnswer={currentAsk.includeAnswer}
      />
    );
  }

  return null;
}

function useComposerFeedFilled(streamId: string | null): boolean {
  const { data: promoted } = usePromotedMessages(streamId ?? "");
  const { data: ttsQueue } = usePlayableTts(streamId ?? "");
  const { data: askQueue } = usePlayableAsk(streamId ?? "");
  if (!streamId) return false;
  return Boolean(promoted?.length || ttsQueue?.length || askQueue?.length);
}

// Real values only. Where a broadcast is not live, or is live but has produced
// nothing yet, every overlay is handed its empty state rather than a stand-in:
// the tab's whole purpose is to show what viewers would see.
export function useOverlayComposerValues(
  channelSlug: string,
  feedVisible: boolean,
  targets: Counts | null
): OverlayStageValues {
  const { data: channel } = useChannel(channelSlug);
  const streamQuery = useLiveStream(channel?.id);
  const stream = streamQuery.data;
  const streamId = stream?.status === "live" ? stream.id : null;

  const { data: goalData } = useGoalProgress(channelSlug, 10, true);
  const { data: scores } = useCompetition(channelSlug, 5);
  const breakQuery = useBreakState(channelSlug);
  const { data: memberCount } = useMemberCount(channelSlug);
  const feedSlotFilled = useComposerFeedFilled(streamId);

  // Never null. An overlay with no value still has a place on the stage, and a
  // goal with no broadcast behind it is honestly zero against its target rather
  // than absent. Targets come from the Settings tab, falling back to the
  // built-in defaults only when nothing is saved.
  const goalMetric = (metric: GoalMetric) => {
    if (goalData?.active && goalData.metrics) {
      return goalData.metrics[metric];
    }
    const target =
      targets?.[metric] ?? goalData?.targets?.[metric] ?? DEFAULT_GOALS[metric];
    return idleProgress(target);
  };

  const competitionEntries: CompetitionEntry[] = (scores ?? [])
    .filter((s) => s.total_score > 0)
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, OVERLAY_LADDER_MAX)
    .map((s) => ({
      key: s.participant_key,
      author: s.author,
      score: s.total_score,
    }));

  const breakEndsAt = breakQuery.data?.breakEndsAt ?? null;

  return {
    feedVisible,
    feedSlot: streamId ? <ComposerFeedSlot streamId={streamId} /> : null,
    feedSlotFilled,
    memberCount: memberCount ?? 0,
    goalMetric,
    competitionEntries,
    breakSlot: breakEndsAt ? (
      <BreakCard key={breakEndsAt} endsAt={breakEndsAt} />
    ) : null,
  };
}

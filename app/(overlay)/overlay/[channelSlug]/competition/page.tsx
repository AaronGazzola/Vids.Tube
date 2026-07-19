"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { OverlayBoxFrame } from "@/components/overlay/box-frame";
import { CompetitionLadder } from "@/components/overlay/competition-ladder";
import { OverlayEmptyState } from "@/components/overlay/empty-placeholder";
import { OVERLAY_BASE_DIMS, OVERLAY_LADDER_SIZE } from "@/lib/demo-overlay";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { useDemoOverlaySnapshot, useOverlayLayout } from "../page.hooks";
import { useCompetition } from "./page.hooks";

export default function CompetitionOverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const sp = useSearchParams();
  const max = Number(sp.get("max")) || 18;
  const size = Number(sp.get("size")) || 56;
  const opacity = sp.get("opacity") != null ? Number(sp.get("opacity")) : 0.6;

  const snapshot = useDemoOverlaySnapshot(channelSlug);
  const { data: layout } = useOverlayLayout(channelSlug);
  const { data: channel } = useChannel(channelSlug);
  const streamQuery = useLiveStream(channel?.id);
  const { data: scores } = useCompetition(channelSlug, 5);

  if (snapshot) {
    const demoEntries = snapshot.competition.slice(0, max);
    if (!snapshot.visible.competition || demoEntries.length === 0) {
      return null;
    }
    return (
      <OverlayBoxFrame scale={snapshot.boxes.competition.scale}>
        <CompetitionLadder
          entries={demoEntries}
          size={OVERLAY_LADDER_SIZE}
          opacity={opacity}
        />
      </OverlayBoxFrame>
    );
  }

  if (streamQuery.isSuccess && streamQuery.data?.status !== "live") {
    return (
      <OverlayBoxFrame scale={layout?.boxes.competition.scale ?? 1}>
        <OverlayEmptyState
          label="Competition"
          width={OVERLAY_BASE_DIMS.competition.w}
          height={OVERLAY_BASE_DIMS.competition.h}
        />
      </OverlayBoxFrame>
    );
  }

  if (!scores) {
    return null;
  }

  const entries = scores
    .filter((s) => s.total_score > 0)
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, max)
    .map((s) => ({
      key: s.participant_key,
      author: s.author,
      score: s.total_score,
    }));
  if (entries.length === 0) {
    return null;
  }

  if (layout) {
    return (
      <OverlayBoxFrame scale={layout.boxes.competition.scale}>
        <CompetitionLadder
          entries={entries}
          size={OVERLAY_LADDER_SIZE}
          opacity={opacity}
        />
      </OverlayBoxFrame>
    );
  }

  return (
    <div className="absolute left-2 top-2">
      <CompetitionLadder entries={entries} size={size} opacity={opacity} />
    </div>
  );
}

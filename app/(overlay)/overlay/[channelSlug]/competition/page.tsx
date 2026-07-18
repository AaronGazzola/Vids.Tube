"use client";

import { CompetitionLadder } from "@/components/overlay/competition-ladder";
import { useSearchParams } from "next/navigation";
import { use } from "react";
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

  const { data: scores } = useCompetition(channelSlug, 5);
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

  return (
    <div className="absolute left-2 top-2">
      <CompetitionLadder entries={entries} size={size} opacity={opacity} />
    </div>
  );
}

"use client";

import { Plant } from "@/components/overlay/plant";
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
  const max = Number(sp.get("max")) || 24;
  const height = Number(sp.get("height")) || 320;

  const { data: scores } = useCompetition(channelSlug, 5);

  if (!scores || scores.length === 0) {
    return null;
  }

  const top = scores.slice(0, max);
  const topScore = Math.max(1, ...top.map((s) => s.total_score));

  return (
    <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-4 p-6">
      {top.map((v) => (
        <Plant
          key={v.participant_key}
          author={v.author}
          score={v.total_score}
          topScore={topScore}
          featuresCount={v.features_count}
          maxHeight={height}
        />
      ))}
    </div>
  );
}

"use client";

import { AvatarBubble } from "@/components/overlay/avatar-bubble";
import { computeStandings } from "@/lib/standings";
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
  const size = Number(sp.get("size")) || 72;
  const opacity = sp.get("opacity") != null ? Number(sp.get("opacity")) : 0.6;

  const { data: scores } = useCompetition(channelSlug, 5);
  if (!scores) {
    return null;
  }

  const active = scores.filter((s) => s.total_score > 0).slice(0, max);
  if (active.length === 0) {
    return null;
  }

  const standings = computeStandings(
    active.map((s) => ({ id: s.participant_key, score: s.total_score }))
  );

  return (
    <div className="absolute inset-x-0 bottom-0 h-1/3">
      {active.map((s, i) => {
        const st = standings.get(s.participant_key) ?? { rank: i + 1, progress: 0 };
        const left = 4 + ((i * 37) % 92);
        const bottom = 6 + ((i * 53) % 60);
        const dur = 6 + (i % 5);
        const delay = (i % 7) * 0.6;
        return (
          <div
            key={s.participant_key}
            className="absolute"
            style={{
              left: `${left}%`,
              bottom: `${bottom}%`,
              opacity,
              animation: `bubble-float ${dur}s ease-in-out ${delay}s infinite`,
            }}
          >
            <AvatarBubble
              author={s.author}
              progress={st.progress}
              rank={st.rank}
              size={size}
            />
          </div>
        );
      })}
    </div>
  );
}

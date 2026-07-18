"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { AvatarBubble } from "@/components/overlay/avatar-bubble";
import { computeStandings } from "@/lib/standings";
import { useEffect, useRef, useState } from "react";

export type CompetitionEntry = {
  key: string;
  author: FeaturedAuthor | null;
  score: number;
};

const CONFETTI_COLORS = [
  "#facc15",
  "#ff6b6b",
  "#1dd1a1",
  "#54a0ff",
  "#f472b6",
  "#fb923c",
];

function rankScale(rank: number): number {
  if (rank === 1) return 1;
  if (rank === 2) return 2 / 3;
  return 1 / 3;
}

type Particle = {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  w: number;
  h: number;
  delay: number;
};

function ConfettiBurst({ size }: { size: number }) {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
      const dist = size * (0.9 + Math.random() * 0.7);
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        rot: (Math.random() * 2 - 1) * 540,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 5 + Math.random() * 4,
        h: 3 + Math.random() * 3,
        delay: Math.random() * 0.08,
      };
    })
  );

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute"
          style={
            {
              left: "50%",
              top: "50%",
              width: p.w,
              height: p.h,
              marginLeft: -p.w / 2,
              marginTop: -p.h / 2,
              background: p.color,
              borderRadius: 1,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              animation: `confetti-burst 700ms cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}s both`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function CompetitionLadder({
  entries,
  size = 56,
  gap = 6,
  opacity = 1,
}: {
  entries: CompetitionEntry[];
  size?: number;
  gap?: number;
  opacity?: number;
}) {
  const ranked = [...entries].sort((a, b) => b.score - a.score);
  const standings = computeStandings(
    ranked.map((e) => ({ id: e.key, score: e.score }))
  );

  const offsets = new Map<string, number>();
  let y = 0;
  for (const e of ranked) {
    const rank = standings.get(e.key)?.rank ?? ranked.length;
    offsets.set(e.key, y);
    y += size * rankScale(rank) + gap;
  }
  const height = Math.max(0, y - gap);
  const width = size + 8;

  const prevRanks = useRef<Map<string, number>>(new Map());
  const burstSeq = useRef(0);
  const [burst, setBurst] = useState<{ key: string; id: number } | null>(null);

  const orderSig = ranked.map((e) => e.key).join("|");
  useEffect(() => {
    const keys = orderSig ? orderSig.split("|") : [];
    const prev = prevRanks.current;
    const leader = keys[0];
    if (leader && prev.size > 0 && prev.get(leader) !== 1) {
      burstSeq.current += 1;
      setBurst({ key: leader, id: burstSeq.current });
    }
    const next = new Map<string, number>();
    keys.forEach((k, i) => next.set(k, i + 1));
    prevRanks.current = next;
  }, [orderSig]);

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 900);
    return () => clearTimeout(t);
  }, [burst]);

  return (
    <div className="relative" style={{ width, height, opacity }}>
      {ranked.map((e) => {
        const st = standings.get(e.key) ?? { rank: ranked.length, progress: 0 };
        const f = rankScale(st.rank);
        return (
          <div
            key={e.key}
            className="absolute"
            style={{
              top: 0,
              right: 4,
              width: size,
              height: size,
              transform: `translateY(${offsets.get(e.key) ?? 0}px) scale(${f})`,
              transformOrigin: "top right",
              transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            {burst?.key === e.key && st.rank === 1 && (
              <ConfettiBurst key={burst.id} size={size} />
            )}
            <div className="relative" style={{ zIndex: 1 }}>
              <AvatarBubble
                author={e.author}
                progress={st.progress}
                rank={st.rank}
                size={size}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

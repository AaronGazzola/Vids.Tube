export type Standing = { rank: number; progress: number };

export function computeStandings(
  items: { id: string; score: number }[]
): Map<string, Standing> {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const out = new Map<string, Standing>();
  sorted.forEach((it, i) => {
    out.set(it.id, {
      rank: i + 1,
      progress: top > 0 ? Math.max(0, Math.min(1, it.score / top)) : 0,
    });
  });
  return out;
}

export function rankColor(rank: number): string {
  if (rank === 1) return "#facc15"; // yellow
  if (rank === 2) return "#c0c0c0"; // silver
  if (rank === 3) return "#ff8c00"; // dark orange
  return "#9ca3af"; // gray
}

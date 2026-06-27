import type { FeaturedAuthor } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { rankColor } from "@/lib/standings";
import { channelAssetUrl } from "@/lib/storage";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

export function AvatarBubble({
  author,
  progress,
  rank,
  size = 72,
}: {
  author: FeaturedAuthor | null;
  progress: number;
  rank: number;
  size?: number;
}) {
  const url = author?.avatarUrl ?? channelAssetUrl(author?.avatarPath ?? null);
  const name = author?.name ?? "viewer";
  const color = rankColor(rank);
  const stroke = Math.max(3, Math.round(size * 0.06));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, progress)) * circ;
  const badge = Math.round(size * 0.3);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <div className="absolute" style={{ inset: stroke + 2 }}>
        <Avatar className="h-full w-full">
          {url && <AvatarImage src={url} alt={name} />}
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
      </div>
      {rank <= 3 && (
        <span
          className="absolute -right-1 -top-1 flex items-center justify-center rounded-full font-bold text-black"
          style={{
            width: badge,
            height: badge,
            fontSize: badge * 0.6,
            background: color,
            border: "2px solid white",
          }}
        >
          {rank}
        </span>
      )}
    </div>
  );
}

import type { FeaturedAuthor } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
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
  const name = author?.name ?? "viewer";
  const url =
    (author?.avatarUrl ?? channelAssetUrl(author?.avatarPath ?? null)) ||
    placeholderAvatar(author?.handle ?? name);
  const color = rankColor(rank);
  const stroke = 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, progress)) * circ;
  const badge = Math.round(size * 0.45);

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
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold text-white"
          style={{
            width: badge,
            height: badge,
            fontSize: badge * 0.6,
            background: "#000",
            border: `2px solid ${color}`,
          }}
        >
          {rank}
        </span>
      )}
    </div>
  );
}

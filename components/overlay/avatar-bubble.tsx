import type { FeaturedAuthor } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { rankColor } from "@/lib/standings";
import { channelAssetUrl } from "@/lib/storage";
import { useId } from "react";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

export function AvatarBubble({
  author,
  progress,
  rank,
  size = 72,
  badgeScale = 1,
  badgeNudge = 0,
  stroke = 3,
  showBadge,
}: {
  author: FeaturedAuthor | null;
  progress: number;
  rank: number;
  size?: number;
  badgeScale?: number;
  badgeNudge?: number;
  stroke?: number;
  showBadge?: boolean;
}) {
  const name = author?.name ?? "viewer";
  const url =
    (author?.avatarUrl ?? channelAssetUrl(author?.avatarPath ?? null)) ||
    placeholderAvatar(author?.handle ?? name);
  const isFirst = rank === 1;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gap = circ * 0.08;
  const trackLen = circ - gap;
  const startOff = gap / 2;
  const dash = Math.max(0, Math.min(1, progress)) * trackLen;
  const badge = Math.round(size * 0.45 * badgeScale);
  const maskId = `ab-${useId().replace(/:/g, "")}`;
  const arcSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}'><circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='black' stroke-width='${Math.max(1, stroke - 2)}' stroke-linecap='round' stroke-dasharray='${trackLen} ${circ}' stroke-dashoffset='${-startOff}' transform='rotate(-75 ${size / 2} ${size / 2})'/></svg>`;
  const arcMask = `url("data:image/svg+xml,${encodeURIComponent(arcSvg)}")`;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0"
        style={{ transform: "rotate(-75deg)" }}
        width={size}
        height={size}
      >
        <mask id={maskId}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${trackLen} ${circ}`}
            strokeDashoffset={-startOff}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="black"
            strokeWidth={Math.max(1, stroke - 2)}
            strokeLinecap="round"
            strokeDasharray={`${trackLen} ${circ}`}
            strokeDashoffset={-startOff}
          />
        </mask>
        <rect width={size} height={size} fill="white" mask={`url(#${maskId})`} />
        {!isFirst && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-startOff}
          />
        )}
      </svg>
      {isFirst && (
        <div
          className="absolute inset-0"
          style={{ WebkitMaskImage: arcMask, maskImage: arcMask }}
        >
          <div className="rainbow-ring absolute inset-0" />
        </div>
      )}
      <div className="absolute" style={{ inset: stroke + 2 }}>
        <Avatar className="h-full w-full">
          {url && <AvatarImage src={url} alt={name} />}
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
      </div>
      {(showBadge ?? rank <= 3) &&
        (isFirst ? (
          <span
            className="absolute overflow-hidden rounded-full"
            style={{
              right: -4 - badgeNudge,
              top: -4 - badgeNudge,
              width: badge,
              height: badge,
            }}
          >
            <span className="rainbow-ring absolute inset-0" />
            <span
              className="absolute flex items-center justify-center rounded-full font-bold text-white"
              style={{
                inset: 2,
                fontSize: badge * 0.6,
                background: "#000",
              }}
            >
              {rank}
            </span>
          </span>
        ) : (
          <span
            className="absolute flex items-center justify-center rounded-full font-bold text-white"
            style={{
              right: -4 - badgeNudge,
              top: -4 - badgeNudge,
              width: badge,
              height: badge,
              fontSize: badge * 0.6,
              background: "#000",
              border: `2px solid ${rankColor(rank)}`,
            }}
          >
            {rank}
          </span>
        ))}
    </div>
  );
}

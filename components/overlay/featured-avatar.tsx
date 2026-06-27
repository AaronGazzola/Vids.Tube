"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { channelAssetUrl } from "@/lib/storage";

const TRAVEL_MS = 8000;
const RING_GAP_PX = 14;
const RING_COLORS = [
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#ef4444",
];

function getInitials(handle: string): string {
  return handle.slice(0, 2).toUpperCase();
}

export function FeaturedAvatar({
  author,
  ringLevel,
  onDone,
}: {
  author: FeaturedAuthor | null;
  ringLevel: number;
  onDone: () => void;
}) {
  const handle = author?.handle ?? null;
  const name = author?.name ?? null;
  const label = handle ? `@${handle}` : name;
  const avatarUrl =
    author?.avatarUrl ?? channelAssetUrl(author?.avatarPath ?? null);
  const rings = Math.max(0, ringLevel);
  const ringSpan = rings * RING_GAP_PX;
  const avatarSize = 96;
  const boxSize = avatarSize + ringSpan * 2;

  return (
    <div className="pointer-events-none absolute bottom-[18vh] left-0">
      <div
        className="relative flex flex-col items-center"
        style={{
          animation: `overlay-travel ${TRAVEL_MS}ms ease-in-out forwards`,
        }}
        onAnimationEnd={onDone}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: boxSize, height: boxSize }}
        >
          {Array.from({ length: rings }).map((_, i) => {
            const inset = i * RING_GAP_PX;
            return (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  inset,
                  border: `3px solid ${RING_COLORS[i % RING_COLORS.length]}`,
                  boxShadow: `0 0 12px ${RING_COLORS[i % RING_COLORS.length]}66`,
                  animation: `overlay-ring-pulse 2.2s ease-in-out ${i * 0.15}s infinite`,
                }}
              />
            );
          })}
          <Avatar
            className="border-2 border-white shadow-xl"
            style={{ width: avatarSize, height: avatarSize }}
          >
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={label ?? ""} />
            )}
            <AvatarFallback className="text-2xl">
              {name ? getInitials(name) : "?"}
            </AvatarFallback>
          </Avatar>
        </div>
        {label && (
          <span
            className="mt-2 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white shadow-lg"
            style={{ fontFamily: "var(--font-logo)" }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

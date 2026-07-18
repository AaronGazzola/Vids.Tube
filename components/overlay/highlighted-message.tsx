"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { AvatarBubble } from "./avatar-bubble";

const HOLD_MS = 7000;

export function HighlightedMessage({
  author,
  text,
  progress,
  rank,
  size = 72,
  persist = false,
  onDone,
}: {
  author: FeaturedAuthor | null;
  text: string;
  progress: number;
  rank: number;
  size?: number;
  persist?: boolean;
  onDone: () => void;
}) {
  const handle = author?.handle ? `@${author.handle}` : null;
  const name = author?.name ?? "viewer";

  return (
    <div
      className="w-full px-3"
      style={{
        animation: persist
          ? "none"
          : `highlight-pop ${HOLD_MS}ms ease-in-out forwards`,
      }}
      onAnimationEnd={persist ? undefined : onDone}
    >
      <div className="flex w-full items-start gap-3">
        <div
          className="flex shrink-0 flex-col items-center"
          style={{ width: size }}
        >
          <AvatarBubble
            author={author}
            progress={progress}
            rank={rank}
            size={size}
            stroke={5}
            showBadge={rank < 99}
          />
          {handle && (
            <span className="mt-1 max-w-full truncate text-sm font-bold text-white drop-shadow">
              {handle}
            </span>
          )}
          <span className="max-w-full truncate text-xs text-white/80 drop-shadow">
            {name}
          </span>
        </div>
        <div
          className="relative flex-1 self-start rounded-xl border border-white bg-black px-4 py-3 text-base leading-relaxed text-white"
          style={{ boxShadow: "0 0 18px 3px rgba(255,255,255,0.4)" }}
        >
          <svg
            aria-hidden
            className="absolute -left-2 top-3.5 overflow-visible"
            width="8"
            height="14"
            viewBox="0 0 8 14"
          >
            <polygon points="8,0 0,7 8,14" fill="black" />
            <polyline
              points="8,0 0,7 8,14"
              fill="none"
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    </div>
  );
}

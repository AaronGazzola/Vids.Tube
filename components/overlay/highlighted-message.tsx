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
  onDone,
}: {
  author: FeaturedAuthor | null;
  text: string;
  progress: number;
  rank: number;
  size?: number;
  onDone: () => void;
}) {
  const handle = author?.handle ? `@${author.handle}` : null;
  const name = author?.name ?? "viewer";

  return (
    <div
      className="w-full px-3"
      style={{ animation: `highlight-pop ${HOLD_MS}ms ease-in-out forwards` }}
      onAnimationEnd={onDone}
    >
      <div className="flex w-full items-start gap-3">
        <div
          className="flex shrink-0 flex-col items-center"
          style={{ width: size }}
        >
          <AvatarBubble author={author} progress={progress} rank={rank} size={size} />
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
          className="relative flex-1 self-start rounded-3xl border border-white bg-black px-4 py-3 text-white"
          style={{ boxShadow: "0 0 18px 3px rgba(255,255,255,0.45)" }}
        >
          <span className="absolute -left-2 top-4 h-4 w-4 rotate-45 border-b border-l border-white bg-black" />
          <p className="text-base leading-snug">{text}</p>
        </div>
      </div>
    </div>
  );
}

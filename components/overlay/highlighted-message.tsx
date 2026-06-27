"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { AvatarBubble } from "./avatar-bubble";

const HOLD_MS = 7000;

export function HighlightedMessage({
  author,
  text,
  progress,
  rank,
  onDone,
}: {
  author: FeaturedAuthor | null;
  text: string;
  progress: number;
  rank: number;
  onDone: () => void;
}) {
  const handle = author?.handle ? `@${author.handle}` : null;
  const name = author?.name ?? "viewer";

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[10%]"
      style={{ animation: `highlight-card ${HOLD_MS}ms ease-in-out forwards` }}
      onAnimationEnd={onDone}
    >
      <div className="flex items-start gap-3">
        <div className="flex w-24 flex-col items-center text-center">
          <AvatarBubble author={author} progress={progress} rank={rank} size={84} />
          {handle && (
            <span className="mt-1 max-w-[6rem] truncate text-sm font-bold text-white drop-shadow">
              {handle}
            </span>
          )}
          <span className="max-w-[6rem] truncate text-xs text-white/80 drop-shadow">
            {name}
          </span>
        </div>
        <div className="relative mt-3 max-w-sm rounded-3xl border-2 border-white bg-black/55 px-4 py-3 text-white shadow-xl backdrop-blur-sm">
          <span className="absolute -left-2 top-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-white bg-black/55" />
          <p className="text-base leading-snug">{text}</p>
        </div>
      </div>
    </div>
  );
}

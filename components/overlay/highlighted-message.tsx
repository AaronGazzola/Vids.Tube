"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { AuthorColumn, SpeechBubble } from "./speech-bubble";

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
        <AuthorColumn
          author={author}
          rank={rank}
          progress={progress}
          size={size}
        />
        <SpeechBubble pointer="left">
          <p className="whitespace-pre-wrap">{text}</p>
        </SpeechBubble>
      </div>
    </div>
  );
}

import type { FeaturedAuthor } from "@/app/layout.types";
import { AvatarBubble } from "./avatar-bubble";

export function SpeechBubble({
  pointer,
  children,
}: {
  pointer: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex-1 self-start rounded-xl border border-white bg-black px-4 py-3 text-base leading-relaxed text-white"
      style={{ boxShadow: "0 0 18px 3px rgba(255,255,255,0.4)" }}
    >
      {pointer === "left" ? (
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
      ) : (
        <svg
          aria-hidden
          className="absolute -right-2 top-3.5 overflow-visible"
          width="8"
          height="14"
          viewBox="0 0 8 14"
        >
          <polygon points="0,0 8,7 0,14" fill="black" />
          <polyline
            points="0,0 8,7 0,14"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
      )}
      {children}
    </div>
  );
}

export function AuthorColumn({
  author,
  rank,
  progress,
  size = 72,
}: {
  author: FeaturedAuthor | null;
  rank: number;
  progress: number;
  size?: number;
}) {
  const handle = author?.handle ? `@${author.handle}` : null;
  const name = author?.name ?? "viewer";
  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: size }}>
      <AvatarBubble
        author={author}
        progress={progress}
        rank={rank}
        size={size}
        stroke={5}
        showBadge={rank < 99}
      />
      {handle && (
        <span className="mt-1 max-w-full truncate text-base font-bold text-white drop-shadow">
          {handle}
        </span>
      )}
      <span className="max-w-full truncate text-sm text-white/80 drop-shadow">
        {name}
      </span>
    </div>
  );
}

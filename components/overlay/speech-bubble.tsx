import type { FeaturedAuthor } from "@/app/layout.types";
import { cn } from "@/lib/utils";
import { AvatarBubble } from "./avatar-bubble";

export function SpeechBubble({
  pointer,
  children,
}: {
  pointer: "left" | "right" | "top";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overlay-surface relative flex-1 rounded-xl border border-white px-4 py-3 text-base leading-relaxed text-white",
        // The top pointer sits above a centred avatar, so the bubble centres too
        // rather than sticking to the left edge when the text is short.
        pointer === "top" ? "self-center" : "self-start"
      )}
      style={
        {
          "--overlay-surface-alpha": 1,
          boxShadow: "0 0 18px 3px rgba(255,255,255,0.4)",
        } as React.CSSProperties
      }
    >
      {pointer === "top" ? (
        // Centred on the top edge, for the card that stacks its avatar above the
        // message rather than beside it.
        <svg
          aria-hidden
          className="absolute -top-2 left-1/2 -translate-x-1/2 overflow-visible"
          width="14"
          height="8"
          viewBox="0 0 14 8"
        >
          <polygon points="0,8 7,0 14,8" fill="black" />
          <polyline
            points="0,8 7,0 14,8"
            fill="none"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
      ) : pointer === "left" ? (
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
  cornerIcon,
}: {
  author: FeaturedAuthor | null;
  rank: number;
  progress: number;
  size?: number;
  cornerIcon?: React.ReactNode;
}) {
  const label = author?.handle
    ? `@${author.handle}`
    : author?.name ?? "viewer";
  const badge = Math.round(size * 0.45);
  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: size }}>
      <div className="relative">
        <AvatarBubble
          author={author}
          progress={progress}
          rank={rank}
          size={size}
          stroke={5}
          showBadge={rank < 99}
        />
        {cornerIcon && (
          <span
            className="absolute flex items-center justify-center rounded-full text-white"
            style={{
              right: -4,
              bottom: -4,
              width: badge,
              height: badge,
              background: "#000",
              border: "2px solid #fff",
            }}
          >
            {cornerIcon}
          </span>
        )}
      </div>
      <span className="mt-1 max-w-full truncate text-base font-bold text-white drop-shadow">
        {label}
      </span>
    </div>
  );
}

import type { FeaturedAuthor } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { plantShape } from "@/lib/plant";
import { channelAssetUrl } from "@/lib/storage";

const FLOWER_COLORS = ["#f59e0b", "#ec4899", "#8b5cf6", "#ef4444"];

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

export function Plant({
  author,
  score,
  topScore,
  featuresCount,
  maxHeight = 320,
}: {
  author: FeaturedAuthor | null;
  score: number;
  topScore: number;
  featuresCount: number;
  maxHeight?: number;
}) {
  const shape = plantShape(score, topScore, featuresCount);
  const name = author?.name ?? "viewer";
  const avatarUrl = author?.avatarUrl ?? channelAssetUrl(author?.avatarPath ?? null);

  const leaves = Array.from({ length: shape.leafPairs }).flatMap((_, i) => {
    const bottom = ((i + 1) / (shape.leafPairs + 1)) * shape.stemPx;
    return [
      <span
        key={`l${i}`}
        className="absolute h-3 w-6 rounded-full bg-emerald-500"
        style={{
          bottom,
          right: "100%",
          transformOrigin: "right center",
          transform: "rotate(28deg)",
        }}
      />,
      <span
        key={`r${i}`}
        className="absolute h-3 w-6 rounded-full bg-emerald-400"
        style={{
          bottom,
          left: "100%",
          transformOrigin: "left center",
          transform: "rotate(-28deg)",
        }}
      />,
    ];
  });

  const flowers = Array.from({ length: shape.flowers }).map((_, i) => (
    <span
      key={`f${i}`}
      className="absolute h-2.5 w-2.5 rounded-full shadow"
      style={{
        bottom: shape.stemPx - 8 - i * 10,
        left: i % 2 === 0 ? -10 : "100%",
        background: FLOWER_COLORS[i % FLOWER_COLORS.length],
      }}
    />
  ));

  return (
    <div
      className="flex w-24 flex-col items-center justify-end"
      style={{ height: maxHeight }}
    >
      <div className="z-10 flex flex-col items-center">
        <Avatar className="h-12 w-12 border-2 border-white shadow-lg">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="mt-1 max-w-[5.5rem] truncate rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          {name}
        </span>
      </div>
      <div
        className="relative -mt-1 w-2 rounded-full bg-gradient-to-t from-emerald-800 to-emerald-400 transition-[height] duration-700 ease-out"
        style={{ height: shape.stemPx }}
      >
        {leaves}
        {flowers}
      </div>
    </div>
  );
}

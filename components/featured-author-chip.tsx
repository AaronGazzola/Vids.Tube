import type { FeaturedAuthor } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import Link from "next/link";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

export function FeaturedAuthorChip({
  author,
  className,
}: {
  author: FeaturedAuthor | null;
  className?: string;
}) {
  if (!author) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-muted-foreground",
          className
        )}
      >
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[0.625rem]">?</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">Unknown</span>
      </span>
    );
  }

  const url = author.avatarUrl ?? channelAssetUrl(author.avatarPath);
  const label = author.handle ? `@${author.handle}` : author.name;
  const inner = (
    <>
      <Avatar className="h-6 w-6">
        {url && <AvatarImage src={url} alt={label} />}
        <AvatarFallback className="text-[0.625rem]">
          {initials(author.name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium">{label}</span>
    </>
  );

  if (author.handle) {
    return (
      <Link
        href={`/${author.handle}`}
        className={cn(
          "inline-flex items-center gap-1.5 hover:underline",
          className
        )}
      >
        {inner}
      </Link>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {inner}
    </span>
  );
}

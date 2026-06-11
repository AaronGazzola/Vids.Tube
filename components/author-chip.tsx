import type { AuthorIdentity } from "@/app/layout.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import Link from "next/link";

function getInitials(handle: string): string {
  return handle.slice(0, 2).toUpperCase();
}

const SIZES = {
  comment: { avatar: "h-6 w-6", text: "text-sm", fallback: "text-[0.625rem]" },
  chat: { avatar: "h-5 w-5", text: "text-xs", fallback: "text-[0.5rem]" },
} as const;

export function AuthorChip({
  author,
  size = "comment",
  className,
}: {
  author: AuthorIdentity;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dims = SIZES[size];

  if (!author) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-muted-foreground",
          className
        )}
      >
        <Avatar className={dims.avatar}>
          <AvatarFallback className={dims.fallback}>?</AvatarFallback>
        </Avatar>
        <span className={cn("font-medium", dims.text)}>Unknown channel</span>
      </span>
    );
  }

  const avatarUrl = channelAssetUrl(author.avatarPath);

  return (
    <Link
      href={`/${author.handle}`}
      className={cn(
        "inline-flex items-center gap-1.5 hover:underline",
        className
      )}
    >
      <Avatar className={dims.avatar}>
        {avatarUrl && <AvatarImage src={avatarUrl} alt={`@${author.handle}`} />}
        <AvatarFallback className={dims.fallback}>
          {getInitials(author.handle)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("font-medium", dims.text)}>@{author.handle}</span>
    </Link>
  );
}

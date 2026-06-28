"use client";

import type { ChatMessage } from "@/app/layout.types";
import { AuthorChip } from "@/components/author-chip";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { cn } from "@/lib/utils";

function VidsTubeBadge() {
  return (
    <span
      title="Vids.Tube"
      className="inline-flex items-center justify-center rounded bg-neutral-900 px-0.75 py-0.5 align-middle"
    >
      <Logo className="h-3 w-3.5 text-white dark:text-white" />
    </span>
  );
}

export function ChatAuthor({
  message,
  size = "chat",
  className,
}: {
  message: Pick<
    ChatMessage,
    "origin" | "author" | "author_name" | "author_avatar_url"
  >;
  size?: "chat" | "comment";
  className?: string;
}) {
  if (message.origin === "youtube") {
    const name = message.author_name ?? "YouTube viewer";
    const url = message.author_avatar_url || placeholderAvatar(name);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 align-middle",
          className
        )}
      >
        <Avatar className={size === "chat" ? "h-5 w-5" : "h-6 w-6"}>
          {url && <AvatarImage src={url} alt={name} />}
          <AvatarFallback className="text-[0.5rem]">
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className={cn("font-medium", size === "chat" ? "text-xs" : "text-sm")}>
          {name}
        </span>
        <span className="rounded bg-red-600 px-1 text-[0.5rem] font-bold leading-tight text-white">
          YT
        </span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 align-middle", className)}>
      <AuthorChip author={message.author} size={size} />
      <VidsTubeBadge />
    </span>
  );
}

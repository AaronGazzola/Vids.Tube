"use client";

import type { ReplayMessage } from "@/app/watch/[videoId]/page.types";
import { AuthorChip } from "@/components/author-chip";
import { Button } from "@/components/ui/button";
import { visibleReplayMessages } from "@/lib/chat-replay";
import { useStickyScroll } from "@/lib/use-sticky-scroll";
import { cn } from "@/lib/utils";
import { ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

export function ChatReplay({
  messages,
  currentTimeMs,
  collapsed,
  onToggleCollapsed,
  className,
}: {
  messages: ReplayMessage[];
  currentTimeMs: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  className?: string;
}) {
  const visible = useMemo(
    () => visibleReplayMessages(messages, currentTimeMs),
    [messages, currentTimeMs]
  );

  const { containerRef, onScroll, showJump, scrollToBottom } =
    useStickyScroll(visible.length);

  if (collapsed) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Show chat replay"
        onClick={onToggleCollapsed}
        className={cn("w-full justify-start gap-2", className)}
      >
        <ChevronLeft className="h-4 w-4" />
        Chat replay
      </Button>
    );
  }

  return (
    <div className={cn("flex h-full min-h-80 flex-col rounded-lg border", className)}>
      <div className="flex items-center justify-between border-b p-3 text-sm font-medium">
        <span>Chat replay</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Collapse chat replay"
          onClick={onToggleCollapsed}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="h-full space-y-2 overflow-y-auto p-3"
        >
          {visible.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Chat replay will appear as the video plays.
            </p>
          ) : (
            visible.map((message) => (
              <div key={message.id} className="text-sm">
                <AuthorChip
                  author={message.author}
                  size="chat"
                  className="mr-1 align-middle"
                />
                <span>{message.body}</span>
              </div>
            ))
          )}
        </div>
        {showJump ? (
          <Button
            type="button"
            size="sm"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 gap-1 rounded-full shadow-md"
          >
            <ArrowDown className="h-4 w-4" />
            New messages
          </Button>
        ) : null}
      </div>
    </div>
  );
}

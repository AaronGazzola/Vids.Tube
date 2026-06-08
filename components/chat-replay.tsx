"use client";

import type { ReplayMessage } from "@/app/watch/[videoId]/page.types";
import { Button } from "@/components/ui/button";
import { visibleReplayMessages } from "@/lib/chat-replay";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

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
  const endRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => visibleReplayMessages(messages, currentTimeMs),
    [messages, currentTimeMs]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

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
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {visible.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Chat replay will appear as the video plays.
          </p>
        ) : (
          visible.map((message) => (
            <div key={message.id} className="text-sm">
              <span className="font-medium text-muted-foreground">
                {message.userId.slice(0, 8)}
              </span>{" "}
              <span>{message.body}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

"use client";

import type { ReplayMessage } from "@/app/watch/[videoId]/page.types";
import { Button } from "@/components/ui/button";
import { visibleReplayMessages } from "@/lib/chat-replay";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

export function ChatReplay({
  messages,
  currentTimeMs,
  onDismiss,
  className,
}: {
  messages: ReplayMessage[];
  currentTimeMs: number;
  onDismiss: () => void;
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

  return (
    <div className={cn("flex h-full min-h-80 flex-col rounded-lg border", className)}>
      <div className="flex items-center justify-between border-b p-3 text-sm font-medium">
        <span>Chat replay</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Hide chat replay"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
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

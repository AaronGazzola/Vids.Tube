"use client";

import { MAX_CHAT_MESSAGE_LENGTH } from "@/app/layout.types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";

const COUNTER_THRESHOLD = 20;

export function ChatComposer({
  onSend,
  pending,
}: {
  onSend: (body: string) => Promise<unknown>;
  pending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const remaining = MAX_CHAT_MESSAGE_LENGTH - draft.length;
  const overLimit = remaining < 0;
  const overBy = -remaining;
  const canSend = draft.trim().length > 0 && !overLimit && !pending;
  const showCounter = remaining <= COUNTER_THRESHOLD;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(draft.trim())
      .then(() => setDraft(""))
      .catch(() => {});
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const syncScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <div
            ref={backdropRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 max-h-32 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent px-2.5 py-2 text-base md:text-sm"
          >
            {draft.slice(0, MAX_CHAT_MESSAGE_LENGTH)}
            <span className="rounded-[2px] bg-destructive/25 text-destructive">
              {draft.slice(MAX_CHAT_MESSAGE_LENGTH)}
            </span>
            {"​"}
          </div>
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            placeholder="Send a message"
            rows={1}
            aria-invalid={overLimit}
            className="relative max-h-32 min-h-9 resize-none bg-transparent text-transparent caret-foreground"
          />
        </div>
        <Button type="submit" disabled={!canSend}>
          Send
        </Button>
      </div>
      {(showCounter || overLimit) && (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-2 text-xs"
        >
          <span className="text-destructive">
            {overLimit
              ? `${overBy} character${overBy === 1 ? "" : "s"} over the ${MAX_CHAT_MESSAGE_LENGTH} limit`
              : ""}
          </span>
          <span
            className={cn(
              "tabular-nums",
              overLimit ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {remaining}
          </span>
        </div>
      )}
    </form>
  );
}

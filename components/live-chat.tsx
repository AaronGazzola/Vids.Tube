"use client";

import { useLiveChat, usePostChatMessage } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { ChatAuthor } from "@/components/chat-author";
import { ChatText } from "@/components/chat-text";
import { ChatComposer } from "@/components/chat-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStickyScroll } from "@/lib/use-sticky-scroll";
import { ArrowDown } from "lucide-react";
import Link from "next/link";

export function LiveChat({ streamId }: { streamId: string | null }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: messages = [], isPending } = useLiveChat(streamId);
  const post = usePostChatMessage(streamId);
  const { containerRef, onScroll, showJump, scrollToBottom } =
    useStickyScroll(messages.length);

  return (
    <div className="flex h-full min-h-80 flex-col rounded-lg border">
      <div className="border-b p-3 text-sm font-medium">Live chat</div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="h-full space-y-2 overflow-y-auto p-3"
        >
        {!streamId ? (
          <p className="text-center text-sm text-muted-foreground">
            Chat is available during live streams.
          </p>
        ) : isPending ? (
          <p className="text-center text-sm text-muted-foreground">
            Loading chat…
          </p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="text-sm">
              <ChatAuthor
                message={message}
                size="chat"
                className="mr-1 align-middle"
              />
              <ChatText text={message.body} />
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
      <div className="border-t p-3">
        {!streamId ? (
          <Input placeholder="Chat is offline" disabled />
        ) : isAuthenticated ? (
          <ChatComposer
            onSend={(body) => post.mutateAsync(body)}
            pending={post.isPending}
          />
        ) : (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Sign in to chat</span>
            <Button asChild size="sm">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

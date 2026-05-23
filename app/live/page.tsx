"use client";

import { useAuthStore } from "@/app/layout.stores";
import { LiveChatPlaceholder } from "@/components/live-chat-placeholder";
import { PlayerPlaceholder } from "@/components/player-placeholder";
import { SignInWall } from "@/components/sign-in-wall";

export default function LivePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 p-4 md:p-6 lg:grid-cols-[1fr_340px]">
      <div>
        {isAuthenticated ? <PlayerPlaceholder variant="live" /> : <SignInWall />}
        <h1 className="mt-4 text-xl font-semibold">Live stream</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placeholder live page
        </p>
      </div>
      <div className="lg:h-[70vh]">
        <LiveChatPlaceholder />
      </div>
    </main>
  );
}

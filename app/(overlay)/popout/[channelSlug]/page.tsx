"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveChat, useLiveStream } from "@/app/layout.hooks";
import { useReadThisQueue } from "@/app/studio/control/page.hooks";
import { useViewerLeaderboard } from "@/app/studio/overlay/page.hooks";
import { ChatAuthor } from "@/components/chat-author";
import { ChatText } from "@/components/chat-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Suspense, use } from "react";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

function PanelShell({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col rounded-lg border border-white/15 bg-white/5",
        className
      )}
    >
      <div className="border-b border-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/70">
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

function Suggestions({
  streamId,
  className,
}: {
  streamId: string | null;
  className?: string;
}) {
  const { data } = useReadThisQueue(streamId);
  const queue = (data ?? []).filter((m) => !m.promoted_at).slice().reverse();
  return (
    <PanelShell title="Read this (AI picks)" className={className}>
      {queue.length === 0 ? (
        <p className="px-1 py-2 text-xs text-white/40">Nothing featured yet.</p>
      ) : (
        <ul className="space-y-2">
          {queue.map((m) => {
            const label = m.author?.handle
              ? `@${m.author.handle}`
              : m.author?.name ?? "viewer";
            const url =
              (m.author?.avatarUrl ??
                channelAssetUrl(m.author?.avatarPath ?? null)) ||
              placeholderAvatar(m.author?.handle ?? m.author?.name);
            return (
              <li
                key={m.id}
                className="rounded-md border border-amber-400/30 bg-amber-400/5 p-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    {url && <AvatarImage src={url} alt={label} />}
                    <AvatarFallback className="text-[10px]">
                      {initials(label)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold">{label}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{m.body ?? ""}</p>
                {m.reason && (
                  <p className="mt-1 text-xs italic text-amber-200/70">
                    {m.reason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

function Chat({
  streamId,
  className,
}: {
  streamId: string | null;
  className?: string;
}) {
  const { data: chat } = useLiveChat(streamId);
  return (
    <PanelShell title="Live chat" className={className}>
      {!chat?.length ? (
        <p className="px-1 py-2 text-xs text-white/40">No messages yet.</p>
      ) : (
        <ul className="space-y-1">
          {chat.map((m) => (
            <li key={m.id} className="text-sm">
              <ChatAuthor message={m} size="chat" className="mr-1" />
              <ChatText text={m.body} />
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

function Leaderboard({
  streamId,
  className,
}: {
  streamId: string | null;
  className?: string;
}) {
  const { data: leaderboard } = useViewerLeaderboard(streamId);
  return (
    <PanelShell title="Leaderboard" className={className}>
      {!leaderboard?.length ? (
        <p className="px-1 py-2 text-xs text-white/40">No scores yet.</p>
      ) : (
        <ul className="space-y-1">
          {leaderboard.map((v, i) => {
            const label = v.author?.handle
              ? `@${v.author.handle}`
              : v.author?.name ?? "viewer";
            const url =
              (v.author?.avatarUrl ??
                channelAssetUrl(v.author?.avatarPath ?? null)) ||
              placeholderAvatar(v.author?.handle ?? v.author?.name);
            return (
              <li
                key={v.participant_key}
                className="flex items-center gap-2 rounded px-1 py-1"
              >
                <span className="w-4 text-xs text-white/40">{i + 1}</span>
                <Avatar className="h-5 w-5 shrink-0">
                  {url && <AvatarImage src={url} alt={label} />}
                  <AvatarFallback className="text-[9px]">
                    {initials(label)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
                <span className="text-xs font-bold tabular-nums">
                  {v.total_score}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

function PopoutInner({ channelSlug }: { channelSlug: string }) {
  const panel = useSearchParams().get("panel") ?? "all";
  const { data: channel } = useChannel(channelSlug);
  const { data: stream } = useLiveStream(channel?.id);
  const streamId = stream?.id ?? null;

  return (
    <div className="flex h-screen flex-col gap-2 bg-neutral-950 p-2 text-white">
      {panel === "suggestions" && (
        <Suggestions streamId={streamId} className="flex-1" />
      )}
      {panel === "chat" && <Chat streamId={streamId} className="flex-1" />}
      {panel === "leaderboard" && (
        <Leaderboard streamId={streamId} className="flex-1" />
      )}
      {panel === "all" && (
        <>
          <Suggestions streamId={streamId} className="flex-2" />
          <Chat streamId={streamId} className="flex-3" />
          <Leaderboard streamId={streamId} className="flex-2" />
        </>
      )}
    </div>
  );
}

export default function PopoutPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  return (
    <Suspense fallback={null}>
      <PopoutInner channelSlug={channelSlug} />
    </Suspense>
  );
}

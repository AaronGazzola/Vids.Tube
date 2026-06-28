"use client";

import { useRequireOwner } from "@/app/layout.hooks";
import { useLiveChat } from "@/app/layout.hooks";
import {
  useOverlayContext,
  useViewerLeaderboard,
} from "@/app/studio/overlay/page.hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { type ReactNode, useState } from "react";
import { useReadThisQueue } from "./page.hooks";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

function Panel({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-col rounded-lg border border-white/15 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          {title}
        </h2>
        {right}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

const MOD_SOON = "Moderation ships in AZ-135";

export default function ControlRoomPage() {
  const { isPending: ownerPending, isOwner } = useRequireOwner();
  const { data: ctx, isPending: ctxPending } = useOverlayContext();

  const streamId = ctx?.streamId ?? null;
  const isLive = ctx?.streamStatus === "live";

  const { data: chat, isPending: chatPending } = useLiveChat(streamId);
  const { data: readThis, isPending: readPending } = useReadThisQueue(streamId);
  const { data: leaderboard, isPending: lbPending } =
    useViewerLeaderboard(streamId);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (ownerPending || !isOwner) {
    return <Skeleton className="h-screen w-full" />;
  }

  const queue = (readThis ?? [])
    .filter((m) => !dismissed.has(m.id))
    .slice()
    .reverse();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 bg-neutral-950 p-3 text-white">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">Control room</h1>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            isLive ? "bg-red-600 text-white" : "bg-white/10 text-white/60"
          )}
        >
          {ctxPending ? "…" : isLive ? "LIVE" : "offline"}
        </span>
        {ctx?.channelSlug && (
          <span className="text-sm text-white/50">@{ctx.channelSlug}</span>
        )}
        <span className="ml-auto text-xs text-white/40">
          scoring {ctx?.enabled ? "on" : "off"}
        </span>
      </div>

      {!streamId && !ctxPending ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-white/15 text-sm text-white/50">
          No broadcast yet — go live, then this fills with chat and AI picks.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1.1fr_1fr_0.8fr]">
          <Panel title="Read this (AI picks)">
            {readPending && streamId ? (
              <Skeleton className="h-16 w-full" />
            ) : queue.length === 0 ? (
              <p className="px-1 py-2 text-xs text-white/40">
                Nothing featured yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {queue.map((m) => {
                  const url =
                    m.author?.avatarUrl ??
                    channelAssetUrl(m.author?.avatarPath ?? null);
                  const label = m.author?.handle
                    ? `@${m.author.handle}`
                    : m.author?.name ?? "viewer";
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-6 px-2 text-xs text-white/60"
                          onClick={() =>
                            setDismissed((prev) => new Set(prev).add(m.id))
                          }
                        >
                          Read ✓
                        </Button>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {m.body ?? ""}
                      </p>
                      {m.reason && (
                        <p className="mt-1 text-xs italic text-amber-200/70">
                          {m.reason}
                        </p>
                      )}
                      {!!m.categories?.length && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.categories.map((c) => (
                            <span
                              key={c}
                              className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Live chat">
            {chatPending && streamId ? (
              <Skeleton className="h-16 w-full" />
            ) : !chat?.length ? (
              <p className="px-1 py-2 text-xs text-white/40">No messages yet.</p>
            ) : (
              <ul className="space-y-1">
                {chat.map((m) => {
                  const url = channelAssetUrl(m.author?.avatarPath ?? null);
                  const label = m.author?.handle
                    ? `@${m.author.handle}`
                    : "viewer";
                  return (
                    <li
                      key={m.id}
                      className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-white/5"
                    >
                      <Avatar className="mt-0.5 h-5 w-5 shrink-0">
                        {url && <AvatarImage src={url} alt={label} />}
                        <AvatarFallback className="text-[9px]">
                          {initials(label)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-white/70">
                          {label}
                        </span>{" "}
                        <span className="text-sm">{m.body}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title={MOD_SOON}
                        className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100"
                      >
                        Hide
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Leaderboard">
            {lbPending && streamId ? (
              <Skeleton className="h-16 w-full" />
            ) : !leaderboard?.length ? (
              <p className="px-1 py-2 text-xs text-white/40">No scores yet.</p>
            ) : (
              <ul className="space-y-1">
                {leaderboard.map((v, i) => {
                  const url =
                    v.author?.avatarUrl ??
                    channelAssetUrl(v.author?.avatarPath ?? null);
                  const label = v.author?.handle
                    ? `@${v.author.handle}`
                    : v.author?.name ?? "viewer";
                  return (
                    <li
                      key={v.participant_key}
                      className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-white/5"
                    >
                      <span className="w-4 text-xs text-white/40">{i + 1}</span>
                      <Avatar className="h-5 w-5 shrink-0">
                        {url && <AvatarImage src={url} alt={label} />}
                        <AvatarFallback className="text-[9px]">
                          {initials(label)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {label}
                      </span>
                      <span className="text-xs font-bold tabular-nums">
                        {v.total_score}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title={MOD_SOON}
                        className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100"
                      >
                        Ban
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

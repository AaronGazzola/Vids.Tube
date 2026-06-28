"use client";

import { useLiveChat, useRequireOwner } from "@/app/layout.hooks";
import {
  useOverlayContext,
  useViewerLeaderboard,
} from "@/app/studio/overlay/page.hooks";
import { ChatAuthor } from "@/components/chat-author";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { type ReactNode, useState } from "react";
import {
  useApproveSuggestion,
  useBanParticipant,
  useDismissSuggestion,
  useHideMessage,
  useModerationFeed,
  useReadThisQueue,
  useSetModerationMode,
  useUnbanParticipant,
  useUnhideMessage,
} from "./page.hooks";

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

export default function ControlRoomPage() {
  const { isPending: ownerPending, isOwner } = useRequireOwner();
  const { data: ctx, isPending: ctxPending } = useOverlayContext();

  const streamId = ctx?.streamId ?? null;
  const isLive = ctx?.streamStatus === "live";

  const { data: chat, isPending: chatPending } = useLiveChat(streamId);
  const { data: readThis, isPending: readPending } = useReadThisQueue(streamId);
  const { data: leaderboard, isPending: lbPending } =
    useViewerLeaderboard(streamId);
  const { data: feed } = useModerationFeed(streamId);

  const setMode = useSetModerationMode(streamId);
  const hide = useHideMessage(streamId);
  const unhide = useUnhideMessage(streamId);
  const ban = useBanParticipant(streamId);
  const unban = useUnbanParticipant(streamId);
  const approve = useApproveSuggestion(streamId);
  const dismiss = useDismissSuggestion(streamId);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (ownerPending || !isOwner) {
    return <Skeleton className="h-screen w-full" />;
  }

  const mode = feed?.mode ?? "manual";
  const actions = feed?.actions ?? [];

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
        {streamId && (
          <div className="flex items-center gap-1 rounded-md border border-white/15 p-0.5 text-xs">
            <span className="px-1 text-white/40">modbot</span>
            {(["manual", "auto"] as const).map((m) => (
              <button
                key={m}
                disabled={setMode.isPending}
                onClick={() => setMode.mutate(m)}
                className={cn(
                  "rounded px-2 py-0.5 font-medium capitalize",
                  mode === m
                    ? m === "auto"
                      ? "bg-red-600 text-white"
                      : "bg-white/20 text-white"
                    : "text-white/50 hover:text-white"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {!streamId && !ctxPending ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-white/15 text-sm text-white/50">
          No broadcast yet — go live, then this fills with chat and AI picks.
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_1fr_0.9fr]">
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
                {chat.map((m) => (
                  <li
                    key={m.id}
                    className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <ChatAuthor message={m} size="chat" className="mr-1" />
                      <span className="text-sm">{m.body}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={hide.isPending}
                      onClick={() => hide.mutate(m.id)}
                      className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100"
                    >
                      Hide
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid min-h-0 grid-rows-2 gap-3">
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
                        <span className="w-4 text-xs text-white/40">
                          {i + 1}
                        </span>
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
                          disabled={ban.isPending}
                          onClick={() =>
                            ban.mutate({
                              participantKey: v.participant_key,
                              origin: v.origin,
                              userId: v.user_id,
                              externalAuthorId: v.external_author_id,
                              authorName: v.author_name,
                            })
                          }
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

            <Panel
              title="Moderation"
              right={
                <span className="text-[10px] text-white/40">
                  {mode === "auto" ? "auto-applying" : "suggestions"}
                </span>
              }
            >
              {actions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-white/40">
                  {mode === "auto"
                    ? "The modbot will act here and log it."
                    : "The modbot will suggest actions here."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {actions.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-xs"
                    >
                      <span
                        className={cn(
                          "rounded px-1 font-semibold uppercase",
                          a.action === "ban"
                            ? "bg-red-600/30 text-red-200"
                            : "bg-amber-500/20 text-amber-200"
                        )}
                      >
                        {a.action}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-white/70">
                        {a.author_name ?? a.participant_key ?? "message"}
                        {a.reason ? ` — ${a.reason}` : ""}
                      </span>
                      {a.status === "suggested" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(a.id)}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={dismiss.isPending}
                            onClick={() => dismiss.mutate(a.id)}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            Dismiss
                          </Button>
                        </>
                      ) : a.status === "applied" &&
                        a.action === "hide" &&
                        a.chat_message_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unhide.isPending}
                          onClick={() => unhide.mutate(a.chat_message_id!)}
                          className="h-5 px-1.5 text-[10px]"
                        >
                          Unhide
                        </Button>
                      ) : a.status === "applied" &&
                        a.action === "ban" &&
                        a.participant_key ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={unban.isPending}
                          onClick={() => unban.mutate(a.participant_key!)}
                          className="h-5 px-1.5 text-[10px]"
                        >
                          Unban
                        </Button>
                      ) : (
                        <span className="text-[10px] text-white/30">
                          {a.status}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

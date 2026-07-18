"use client";

import { useGoalProgress } from "@/app/(overlay)/overlay/[channelSlug]/goals/page.hooks";
import type {
  ChatMessage,
  FeaturedMessageWithAuthor,
  ViewerScoreWithAuthor,
} from "@/app/layout.types";
import { ChatAuthor } from "@/components/chat-author";
import { ChatText } from "@/components/chat-text";
import { OriginBadge } from "@/components/origin-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { channelAssetUrl } from "@/lib/storage";
import { useChatAutoScroll } from "@/lib/use-chat-autoscroll";
import { cn } from "@/lib/utils";
import { ChevronDown, EllipsisVertical, Info, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  useOverlayContext,
  useViewerLeaderboard,
} from "./overlay.hooks";
import {
  useApproveSuggestion,
  useBanParticipant,
  useDismissSuggestion,
  useHideMessage,
  useManualHighlight,
  useModerationFeed,
  useOwnerChat,
  usePromoteHighlight,
  useReadThisQueue,
  useUnbanParticipant,
  useUnhideMessage,
} from "./page.hooks";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

function participantKeyOf(m: {
  origin: string;
  user_id: string | null;
  external_author_id: string | null;
}): string {
  return m.origin === "vidstube"
    ? String(m.user_id)
    : `youtube:${m.external_author_id}`;
}

// ── Goals header ──────────────────────────────────────────────────────────

function MetricBar({
  label,
  current,
  goal,
  pct,
}: {
  label: string;
  current: number;
  goal: number;
  pct: number;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium capitalize">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {current} / {goal}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function GoalsHeader({ channelSlug }: { channelSlug: string }) {
  const { data } = useGoalProgress(channelSlug, 5);
  const metrics = data?.active && data.metrics ? data.metrics : null;
  if (!metrics) {
    return (
      <p className="text-xs text-muted-foreground">
        Goals appear here once a YouTube video is set and the stream is live.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-4">
      <MetricBar
        label="subs"
        current={metrics.subs.current}
        goal={metrics.subs.goal}
        pct={metrics.subs.pct}
      />
      <MetricBar
        label="likes"
        current={metrics.likes.current}
        goal={metrics.likes.goal}
        pct={metrics.likes.pct}
      />
      <MetricBar
        label="viewers"
        current={metrics.viewers.current}
        goal={metrics.viewers.goal}
        pct={metrics.viewers.pct}
      />
    </div>
  );
}

// ── Competition (collapsible) ─────────────────────────────────────────────

function competitorLabel(v: ViewerScoreWithAuthor): string {
  return v.author?.handle ? `@${v.author.handle}` : v.author?.name ?? "viewer";
}

function competitorAvatar(v: ViewerScoreWithAuthor): string {
  return (
    (v.author?.avatarUrl ?? channelAssetUrl(v.author?.avatarPath ?? null)) ||
    placeholderAvatar(v.author?.handle ?? v.author?.name)
  );
}

function CompetitorBadge({
  v,
  rank,
}: {
  v: ViewerScoreWithAuthor;
  rank: number;
}) {
  const label = competitorLabel(v);
  const url = competitorAvatar(v);
  return (
    <Badge variant="secondary" className="gap-1.5 py-1 pl-1.5 pr-2 text-xs font-normal">
      <span className="font-bold text-muted-foreground">#{rank}</span>
      <Avatar className="h-4 w-4 shrink-0">
        {url && <AvatarImage src={url} alt={label} />}
        <AvatarFallback className="text-[8px]">{initials(label)}</AvatarFallback>
      </Avatar>
      <span className="max-w-28 truncate">{label}</span>
      <span className="font-bold tabular-nums">{v.total_score}</span>
    </Badge>
  );
}

function CompetitionRow({
  v,
  rank,
}: {
  v: ViewerScoreWithAuthor;
  rank: number;
}) {
  const label = competitorLabel(v);
  const url = competitorAvatar(v);
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="w-5 text-xs text-muted-foreground">#{rank}</span>
      <Avatar className="h-5 w-5 shrink-0">
        {url && <AvatarImage src={url} alt={label} />}
        <AvatarFallback className="text-[9px]">{initials(label)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
      <span className="text-xs font-bold tabular-nums">{v.total_score}</span>
    </li>
  );
}

function Competition({ streamId }: { streamId: string | null }) {
  const { data: leaderboard, isPending } = useViewerLeaderboard(streamId);
  const [expanded, setExpanded] = useState(false);
  const rows = leaderboard ?? [];
  const top3 = rows.slice(0, 3);

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
      >
        <span>Competition</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
        />
      </button>
      <div className="border-t px-3 py-2">
        {isPending && streamId ? (
          <Skeleton className="h-8 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No scores yet.</p>
        ) : expanded ? (
          <ul>
            {rows.map((v, i) => (
              <CompetitionRow key={v.participant_key} v={v} rank={i + 1} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-2">
            {top3.map((v, i) => (
              <CompetitorBadge key={v.participant_key} v={v} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score, reason }: { score: number; reason: string | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300"
          aria-label="Why this was featured"
        >
          <Sparkles className="h-3 w-3" />
          {score}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-xs">
        <p className="font-semibold">Featured · score {score}</p>
        <p className="mt-1 text-muted-foreground">
          {reason || "The bot rated this a standout message."}
        </p>
      </PopoverContent>
    </Popover>
  );
}

function MessageMenu({
  msg,
  streamId,
}: {
  msg: ChatMessage;
  streamId: string;
}) {
  const hide = useHideMessage(streamId);
  const ban = useBanParticipant(streamId);
  const highlight = useManualHighlight(streamId);
  const [banOpen, setBanOpen] = useState(false);
  const [hidePast, setHidePast] = useState(true);
  const label = msg.author?.handle
    ? `@${msg.author.handle}`
    : msg.author_name ?? "user";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Message actions"
          >
            <EllipsisVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={highlight.isPending}
            onClick={() => highlight.mutate(msg.id)}
          >
            Highlight on overlay
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={hide.isPending}
            onClick={() => hide.mutate(msg.id)}
          >
            Hide message
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setBanOpen(true)}
          >
            Ban {label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={banOpen} onOpenChange={setBanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be blocked from chatting on your channel. You can unban
              from Account → Banned users or the mod bot actions panel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={hidePast}
              onCheckedChange={(v) => setHidePast(v === true)}
            />
            Hide all their past messages in this stream
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                ban.mutate({
                  participantKey: participantKeyOf(msg),
                  origin: msg.origin,
                  userId: msg.user_id,
                  externalAuthorId: msg.external_author_id,
                  authorName: msg.author_name,
                  hidePastMessages: hidePast,
                })
              }
            >
              Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChatMessageRow({
  msg,
  featured,
  streamId,
}: {
  msg: ChatMessage;
  featured: FeaturedMessageWithAuthor | undefined;
  streamId: string;
}) {
  const unhide = useUnhideMessage(streamId);
  const promote = usePromoteHighlight(streamId);
  const dismiss = useDismissSuggestion(streamId);
  const [revealed, setRevealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hidden = !!msg.hidden_at;
  const suggested = !!featured && !featured.promoted_at && !dismissed;

  // Hidden + collapsed → thin row with a Reveal popover.
  if (hidden && !revealed) {
    return (
      <li>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-[11px] italic text-muted-foreground hover:bg-muted">
              <span>Message hidden ({msg.hidden_by ?? "owner"})</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => setRevealed(true)}
            >
              Reveal
            </Button>
          </PopoverContent>
        </Popover>
      </li>
    );
  }

  // Hidden + revealed → hidden styling with Hide (recollapse) / Unhide (publish).
  if (hidden && revealed) {
    return (
      <li className="rounded border border-dashed px-2 py-1 opacity-70">
        <div className="text-sm">
          <ChatAuthor message={msg} size="chat" className="mr-1" />
          <ChatText text={msg.body} />
        </div>
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setRevealed(false)}>
            Hide
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            disabled={unhide.isPending}
            onClick={() => unhide.mutate(msg.id)}
          >
            Unhide
          </Button>
        </div>
      </li>
    );
  }

  // Feature-suggested → prominent styling with Highlight / Dismiss.
  if (suggested && featured) {
    return (
      <li className="rounded-md border border-amber-400/50 bg-amber-400/10 p-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ChatAuthor message={msg} size="chat" className="mr-1" />
            <ChatText text={msg.body} className="mt-1 block text-sm" />
          </div>
          <MessageMenu msg={msg} streamId={streamId} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={promote.isPending}
            onClick={() => promote.mutate(featured.id)}
          >
            Highlight
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground"
            disabled={dismiss.isPending}
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
          {featured.reason && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground"
                  aria-label="Why this was featured"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm">
                <p className="font-semibold">Why featured · score {featured.score}</p>
                <p className="mt-1.5 text-muted-foreground">{featured.reason}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </li>
    );
  }

  // Normal (incl. already highlighted/dismissed → secondary styling). The
  // three-dot menu stays visible so highlighted messages keep their actions;
  // bot rows are the bot's own output and carry no moderation or scoring.
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded px-1 py-1 hover:bg-muted",
        featured && "bg-muted/50"
      )}
    >
      <div className="min-w-0 flex-1">
        <ChatAuthor message={msg} size="chat" className="mr-1" />
        <ChatText text={msg.body} className="text-sm" />
        {featured && msg.origin !== "bot" && (
          <span className="ml-1 align-middle">
            <ScoreBadge score={featured.score} reason={featured.reason} />
          </span>
        )}
      </div>
      {msg.origin !== "bot" && <MessageMenu msg={msg} streamId={streamId} />}
    </li>
  );
}

function ChatPanel({ streamId }: { streamId: string }) {
  const { data: chat, isPending } = useOwnerChat(streamId);
  const { data: featured } = useReadThisQueue(streamId);
  const { scrollRef, contentRef, onScroll } = useChatAutoScroll(
    chat?.length ?? 0
  );

  const featuredByMsg = new Map<string, FeaturedMessageWithAuthor>();
  for (const f of featured ?? []) {
    if (f.chat_message_id) featuredByMsg.set(f.chat_message_id, f);
  }

  return (
    <div className="flex min-h-[250px] flex-1 flex-col rounded-lg border">
      <div className="shrink-0 border-b px-3 py-2 text-sm font-semibold">Live chat</div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        <div ref={contentRef}>
          {isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : !chat?.length ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {chat.map((m) => (
                <ChatMessageRow
                  key={m.id}
                  msg={m}
                  featured={featuredByMsg.get(m.id)}
                  streamId={streamId}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mod bot actions component ─────────────────────────────────────────────

function ModBotActions({ streamId }: { streamId: string }) {
  const { data: feed } = useModerationFeed(streamId);
  const approve = useApproveSuggestion(streamId);
  const dismiss = useDismissSuggestion(streamId);
  const unhide = useUnhideMessage(streamId);
  const unban = useUnbanParticipant(streamId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"hidden" | "banned">("hidden");

  const actions = feed?.actions ?? [];
  const hidden = actions.filter((a) => a.action === "hide");
  const banned = actions.filter((a) => a.action === "ban");
  const list = tab === "hidden" ? hidden : banned;

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
      >
        <span>
          Mod bot actions
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {hidden.length} hidden · {banned.length} banned
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t p-2">
          <div className="mb-2 flex gap-1">
            {(["hidden", "banned"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-medium capitalize",
                  tab === t ? "bg-muted text-foreground" : "text-muted-foreground"
                )}
              >
                {t} ({t === "hidden" ? hidden.length : banned.length})
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Nothing here yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {list.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <OriginBadge origin={a.origin} className="mr-1" />
                    <span className="font-semibold">{a.sender}</span>
                    {a.body && <span className="text-muted-foreground"> “{a.body}”</span>}
                    {a.reason && (
                      <span className="block text-[10px] italic text-muted-foreground">
                        {a.reason}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {a.source === "ai" ? "bot" : "owner"} · {a.status}
                    </span>
                  </div>
                  {a.status === "suggested" ? (
                    <>
                      <Button
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(a.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 px-1.5 text-[10px]"
                        disabled={dismiss.isPending}
                        onClick={() => dismiss.mutate(a.id)}
                      >
                        Dismiss
                      </Button>
                    </>
                  ) : a.status === "applied" && a.action === "hide" && a.chat_message_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 px-1.5 text-[10px]"
                      disabled={unhide.isPending}
                      onClick={() => unhide.mutate(a.chat_message_id!)}
                    >
                      Unhide
                    </Button>
                  ) : a.status === "applied" && a.action === "ban" && a.participant_key ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 px-1.5 text-[10px]"
                      disabled={unban.isPending}
                      onClick={() => unban.mutate(a.participant_key!)}
                    >
                      Unban
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────

// Shared Activity content — rendered both in the /live Activity tab and, verbatim,
// in the pop-out window so the two match exactly.
export function ActivityContent() {
  const { data: ctx, isPending } = useOverlayContext();
  const streamId = ctx?.streamId ?? null;

  if (!streamId && !isPending) {
    return (
      <div className="flex min-h-60 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        No active broadcast — go live and this fills with goals, chat, and mod
        activity.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-3 rounded-lg border p-3">
        <GoalsHeader channelSlug={ctx?.channelSlug ?? ""} />
        <Competition streamId={streamId} />
      </div>

      {streamId && (
        <div className="shrink-0">
          <ModBotActions streamId={streamId} />
        </div>
      )}
      {streamId && <ChatPanel streamId={streamId} />}
    </div>
  );
}

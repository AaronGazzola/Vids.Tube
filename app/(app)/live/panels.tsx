"use client";

import { useGoalProgress } from "@/app/(overlay)/overlay/[channelSlug]/goals/page.hooks";
import type {
  ChatMessage,
  FeaturedMessageWithAuthor,
  ViewerScoreWithAuthor,
} from "@/app/layout.types";
import { usePostChatMessage } from "@/app/layout.hooks";
import { ChatAuthor } from "@/components/chat-author";
import { ChatComposer } from "@/components/chat-composer";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  EllipsisVertical,
  HelpCircle,
  Info,
  Scissors,
  Shield,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  useOverlayContext,
  useViewerLeaderboard,
} from "./overlay.hooks";
import {
  useApproveAsk,
  useApproveSuggestion,
  useApproveTts,
  useAskFeed,
  useBanParticipant,
  useClipMarkers,
  useDismissAsk,
  useDismissSuggestion,
  useDismissTts,
  useHideMessage,
  useManualHighlight,
  useManualTts,
  useModerationFeed,
  useOwnerChat,
  usePromoteHighlight,
  useReadThisQueue,
  useRequestWrapup,
  useTtsFeed,
  useUnbanParticipant,
  useUnhideMessage,
} from "./page.hooks";
import type {
  AskFeedItem,
  ClipMarker,
  TtsFeedItem,
} from "./page.actions";

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
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 text-xs font-medium capitalize">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {current}/{goal}
      </span>
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
        goal={metrics.subs.target}
        pct={metrics.subs.pct}
      />
      <MetricBar
        label="likes"
        current={metrics.likes.current}
        goal={metrics.likes.target}
        pct={metrics.likes.pct}
      />
      <MetricBar
        label="viewers"
        current={metrics.viewers.current}
        goal={metrics.viewers.target}
        pct={metrics.viewers.pct}
      />
    </div>
  );
}

// ── Indicator popovers (tab-bar row) ──────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function competitorLabel(v: ViewerScoreWithAuthor): string {
  return v.author?.handle ? `@${v.author.handle}` : v.author?.name ?? "viewer";
}

function competitorAvatar(v: ViewerScoreWithAuthor): string {
  return (
    (v.author?.avatarUrl ?? channelAssetUrl(v.author?.avatarPath ?? null)) ||
    placeholderAvatar(v.author?.handle ?? v.author?.name)
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

function CompetitionIndicator({ streamId }: { streamId: string | null }) {
  const { data: leaderboard } = useViewerLeaderboard(streamId);
  const rows = leaderboard ?? [];
  const leader = rows[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full"
          aria-label="Competition leaderboard"
        >
          {leader ? (
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={competitorAvatar(leader)}
                alt={competitorLabel(leader)}
              />
              <AvatarFallback className="text-[9px]">
                {initials(competitorLabel(leader))}
              </AvatarFallback>
            </Avatar>
          ) : (
            <Trophy className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <p className="text-sm font-semibold">Competition</p>
        {rows.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No scores yet.</p>
        ) : (
          <ul className="mt-1 max-h-80 overflow-y-auto">
            {rows.map((v, i) => (
              <CompetitionRow key={v.participant_key} v={v} rank={i + 1} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
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
  const speak = useManualTts(streamId);
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
            disabled={speak.isPending}
            onClick={() => speak.mutate(msg.id)}
          >
            Read aloud (TTS)
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

type CardTone = "amber" | "violet" | "sky" | "gray";

const CARD_TONE: Record<CardTone, string> = {
  amber: "border-amber-400/50 bg-amber-400/10",
  violet: "border-violet-400/50 bg-violet-400/10",
  sky: "border-sky-400/50 bg-sky-400/10",
  gray: "border-muted-foreground/30 bg-muted/40",
};

const PILL_TONE: Record<CardTone, string> = {
  amber: "bg-amber-400/15 text-amber-700 dark:text-amber-300",
  violet: "bg-violet-400/15 text-violet-700 dark:text-violet-300",
  sky: "bg-sky-400/15 text-sky-700 dark:text-sky-300",
  gray: "bg-muted-foreground/15 text-muted-foreground",
};

function StatusPill({
  tone,
  label,
  icon,
}: {
  tone: CardTone;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        PILL_TONE[tone]
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function ttsStatusLabel(status: string): string {
  switch (status) {
    case "suggested":
      return "TTS · pending";
    case "approved":
      return "TTS · approved";
    case "played":
      return "TTS · played";
    case "dismissed":
      return "TTS · dismissed";
    case "cooldown":
      return "TTS · not applied · cooldown";
    default:
      return `TTS · ${status}`;
  }
}

function askStatusLabel(status: string): string {
  switch (status) {
    case "suggested":
      return "Ask · pending";
    case "approved":
      return "Ask · answered";
    case "shown":
      return "Ask · shown";
    case "dismissed":
      return "Ask · dismissed";
    default:
      return `Ask · ${status}`;
  }
}

function ChatMessageRow({
  msg,
  featured,
  tts,
  ask,
  clip,
  streamId,
}: {
  msg: ChatMessage;
  featured: FeaturedMessageWithAuthor | undefined;
  tts: TtsFeedItem | undefined;
  ask: AskFeedItem | undefined;
  clip: ClipMarker | undefined;
  streamId: string;
}) {
  const unhide = useUnhideMessage(streamId);
  const promote = usePromoteHighlight(streamId);
  const dismiss = useDismissSuggestion(streamId);
  const approveTts = useApproveTts(streamId);
  const dismissTts = useDismissTts(streamId);
  const approveAsk = useApproveAsk(streamId);
  const dismissAsk = useDismissAsk(streamId);
  const [revealed, setRevealed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hidden = !!msg.hidden_at;

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

  // Any TTS (!tts) request → violet card, so every read-aloud request stays
  // visible whatever its state (pending, approved, played, dismissed). Approve /
  // Dismiss show only while it's still pending.
  if (tts) {
    const pending = tts.status === "suggested";
    const tone: CardTone = tts.status === "cooldown" ? "gray" : "violet";
    return (
      <li
        className={cn(
          "rounded-md border p-2",
          CARD_TONE[tone],
          (tts.status === "dismissed" || tts.status === "cooldown") &&
            "opacity-70"
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ChatAuthor message={msg} size="chat" className="mr-1" />
            <ChatText text={msg.body} className="mt-1 block text-sm" />
            {tts.reason && (
              <span className="block text-[10px] italic text-muted-foreground">
                {tts.reason}
              </span>
            )}
          </div>
          {msg.origin !== "bot" && <MessageMenu msg={msg} streamId={streamId} />}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StatusPill
            tone={tone}
            icon={<Volume2 className="h-3 w-3" />}
            label={`${ttsStatusLabel(tts.status)}${tts.voice ? ` · ${tts.voice}` : ""}`}
          />
          {pending && (
            <>
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={approveTts.isPending}
                onClick={() => approveTts.mutate(tts.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground"
                disabled={dismissTts.isPending}
                onClick={() => dismissTts.mutate(tts.id)}
              >
                Dismiss
              </Button>
            </>
          )}
        </div>
      </li>
    );
  }

  // Any ask (!ask) request → sky card with the AI answer preview, so every
  // question stays visible whatever its state (pending, answered, shown,
  // dismissed). The three answer choices show only while pending.
  if (ask) {
    const pending = ask.status === "suggested";
    return (
      <li
        className={cn(
          "rounded-md border p-2",
          CARD_TONE.sky,
          ask.status === "dismissed" && "opacity-70"
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ChatAuthor message={msg} size="chat" className="mr-1" />
            <ChatText text={msg.body} className="mt-1 block text-sm" />
            {ask.answer && (
              <span className="mt-0.5 block text-sm text-sky-700 dark:text-sky-300">
                ↳ {ask.answer}
              </span>
            )}
            {ask.reason && (
              <span className="block text-[10px] italic text-muted-foreground">
                {ask.reason}
              </span>
            )}
          </div>
          {msg.origin !== "bot" && <MessageMenu msg={msg} streamId={streamId} />}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StatusPill
            tone="sky"
            icon={<HelpCircle className="h-3 w-3" />}
            label={askStatusLabel(ask.status)}
          />
          {pending && (
            <>
              {ask.answer && (
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={approveAsk.isPending}
                  onClick={() =>
                    approveAsk.mutate({ id: ask.id, includeAnswer: true })
                  }
                >
                  Answer
                </Button>
              )}
              <Button
                size="sm"
                variant={ask.answer ? "outline" : "default"}
                className="h-6 px-2 text-xs"
                disabled={approveAsk.isPending}
                onClick={() =>
                  approveAsk.mutate({ id: ask.id, includeAnswer: false })
                }
              >
                {ask.answer ? "Question only" : "Show question"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground"
                disabled={dismissAsk.isPending}
                onClick={() => dismissAsk.mutate(ask.id)}
              >
                Dismiss
              </Button>
            </>
          )}
        </div>
      </li>
    );
  }

  // Any featured message → amber card, so AI-highlighted messages stay visually
  // distinct even when auto-display promoted them straight to the overlay. While
  // pending (manual mode, not yet promoted) show Highlight / Dismiss; once on the
  // overlay show an "on overlay" pill instead. A locally-dismissed suggestion
  // falls through to the normal row below.
  if (featured && msg.origin !== "bot" && !dismissed) {
    const promoted = !!featured.promoted_at;
    return (
      <li className={cn("rounded-md border p-2", CARD_TONE.amber)}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ChatAuthor message={msg} size="chat" className="mr-1" />
            <ChatText text={msg.body} className="mt-1 block text-sm" />
          </div>
          <MessageMenu msg={msg} streamId={streamId} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          {promoted ? (
            <>
              <StatusPill
                tone="amber"
                icon={<Sparkles className="h-3 w-3" />}
                label="Highlighted"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                disabled={promote.isPending}
                onClick={() => promote.mutate(featured.id)}
              >
                Show again
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
          <span className="text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            score {featured.score}
          </span>
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

  // Normal row (bot output, or a locally-dismissed featured suggestion). TTS,
  // ask, and un-dismissed featured messages are handled as cards above; clip
  // requests carry an emerald accent with the marker timestamp. The three-dot
  // menu stays visible on viewer rows; bot rows carry no moderation or scoring.
  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded px-1 py-1 hover:bg-muted",
        featured && "bg-muted/50",
        clip && "border-l-2 border-emerald-400 bg-emerald-400/5 pl-2"
      )}
    >
      <div className="min-w-0 flex-1">
        <ChatAuthor message={msg} size="chat" className="mr-1" />
        {clip && (
          <code className="mr-1 rounded bg-emerald-400/15 px-1 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 align-middle dark:text-emerald-300">
            {formatClipTime(clip.streamTimeS)}
          </code>
        )}
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

// What the chat panel shows, and why it might be showing nothing. Three empty
// states have to stay apart: no chat has arrived, chat has arrived but the
// filter hides all of it, and the first load has not finished. Deciding that in
// one place is what stops "nothing featured yet" reading as a broken tab.
export function chatPanelView<T extends { id: string }>(
  chat: T[] | undefined,
  isFeatured: (id: string) => boolean,
  highlightsOnly: boolean
): { rows: T[]; empty: "no-chat" | "nothing-featured" | null } {
  const all = chat ?? [];
  if (!all.length) return { rows: [], empty: "no-chat" };
  const rows = highlightsOnly ? all.filter((m) => isFeatured(m.id)) : all;
  return { rows, empty: rows.length ? null : "nothing-featured" };
}

function ChatPanel({ streamId }: { streamId: string }) {
  const { data: chat, isPending, refetch } = useOwnerChat(streamId);
  const { data: featured } = useReadThisQueue(streamId);
  const { data: ttsFeed } = useTtsFeed(streamId);
  const { data: askFeed } = useAskFeed(streamId);
  const { data: clipMarkers } = useClipMarkers(streamId);
  const post = usePostChatMessage(streamId);
  // A view filter and nothing else: held here rather than in a store or the
  // layout, so it cannot outlive the page or reach a broadcast.
  const [highlightsOnly, setHighlightsOnly] = useState(false);

  const featuredByMsg = new Map<string, FeaturedMessageWithAuthor>();
  for (const f of featured ?? []) {
    if (f.chat_message_id) featuredByMsg.set(f.chat_message_id, f);
  }
  const ttsByMsg = new Map<string, TtsFeedItem>();
  for (const t of ttsFeed ?? []) {
    if (t.chatMessageId) ttsByMsg.set(t.chatMessageId, t);
  }
  const askByMsg = new Map<string, AskFeedItem>();
  for (const a of askFeed ?? []) {
    if (a.chatMessageId) askByMsg.set(a.chatMessageId, a);
  }
  const clipByMsg = new Map<string, ClipMarker>();
  for (const c of clipMarkers ?? []) {
    if (c.chatMessageId) clipByMsg.set(c.chatMessageId, c);
  }

  const view = chatPanelView(
    chat,
    (id) => featuredByMsg.has(id),
    highlightsOnly
  );
  // Follows what is rendered, so turning the filter on does not leave the view
  // scrolled to a position the shorter list no longer has.
  const { scrollRef, contentRef, onScroll } = useChatAutoScroll(view.rows.length);

  return (
    <div className="flex min-h-[300px] flex-1 flex-col rounded-lg border">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <span className="flex-1">Live chat</span>
        <Button
          type="button"
          size="sm"
          variant={highlightsOnly ? "secondary" : "ghost"}
          className="h-7 gap-1.5 px-2 text-xs font-medium"
          aria-pressed={highlightsOnly}
          onClick={() => setHighlightsOnly((on) => !on)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Highlights only
        </Button>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto p-2"
      >
        <div ref={contentRef}>
          {isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : view.empty === "no-chat" ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No messages yet.
            </p>
          ) : view.empty === "nothing-featured" ? (
            // Distinct from having no chat at all: the filter is on and the AI
            // has featured nothing yet, which is normal early in a broadcast.
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Nothing featured yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {view.rows.map((m) => (
                <ChatMessageRow
                  key={m.id}
                  msg={m}
                  featured={featuredByMsg.get(m.id)}
                  tts={ttsByMsg.get(m.id)}
                  ask={askByMsg.get(m.id)}
                  clip={clipByMsg.get(m.id)}
                  streamId={streamId}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="shrink-0 border-t p-2">
        <ChatComposer
          onSend={(body) => post.mutateAsync(body).then(() => refetch())}
          pending={post.isPending}
        />
      </div>
    </div>
  );
}

// ── Mod bot actions component ─────────────────────────────────────────────

export function WrapupButton({ streamId }: { streamId: string }) {
  const wrapup = useRequestWrapup(streamId);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={wrapup.isPending}>
          Wrap up
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send the wrap-up messages?</AlertDialogTitle>
          <AlertDialogDescription>
            The bot posts the end-of-stream messages you enabled in Settings
            (MVP, achievement summary, thanks with project links) to both chats.
            This happens once per stream.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => wrapup.mutate()}>
            Wrap up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatClipTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function ClipMarkersIndicator({ streamId }: { streamId: string | null }) {
  const { data: markers } = useClipMarkers(streamId);
  const items = markers ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Clip markers"
        >
          <Scissors className="h-4 w-4" />
          <CountBadge count={items.length} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-1 pb-1 text-sm font-semibold">
          Clip markers
          {!streamId && items[0]?.streamTitle && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {items[0].streamTitle}
            </span>
          )}
        </p>
        {items.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No clip markers yet — viewers drop them with !clip.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {items.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs"
              >
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                  {formatClipTime(m.streamTimeS)}
                </code>
                <div className="min-w-0 flex-1">
                  <OriginBadge origin={m.origin} className="mr-1" />
                  <span className="font-semibold">{m.authorName ?? "viewer"}</span>
                  {m.snippet && (
                    <span className="block text-muted-foreground">
                      {m.snippet}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ModBotActionsIndicator({ streamId }: { streamId: string }) {
  const { data: feed } = useModerationFeed(streamId);
  const approve = useApproveSuggestion(streamId);
  const dismiss = useDismissSuggestion(streamId);
  const unhide = useUnhideMessage(streamId);
  const unban = useUnbanParticipant(streamId);
  const [tab, setTab] = useState<"hidden" | "banned">("hidden");

  const actions = feed?.actions ?? [];
  const hidden = actions.filter((a) => a.action === "hide");
  const banned = actions.filter((a) => a.action === "ban");
  const list = tab === "hidden" ? hidden : banned;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-8 w-8"
          aria-label="Mod bot actions"
        >
          <Shield className="h-4 w-4" />
          <CountBadge count={actions.length} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <p className="px-1 pb-1 text-sm font-semibold">Mod bot actions</p>
        <div>
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
            <ul className="max-h-80 space-y-1 overflow-y-auto">
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
      </PopoverContent>
    </Popover>
  );
}

// ── Activity tab ──────────────────────────────────────────────────────────

// Icon-with-badge popovers rendered in the tab bar next to the tab triggers
// (and in the pop-out header): goals, competition, mod bot actions, clip
// markers. The competition trigger is the leading chatter's avatar.
export function ActivityIndicators() {
  const { data: ctx } = useOverlayContext();
  const streamId = ctx?.streamId ?? null;

  return (
    <div className="flex items-center gap-1.5">
      <CompetitionIndicator streamId={streamId} />
      {streamId && <ModBotActionsIndicator streamId={streamId} />}
      <ClipMarkersIndicator streamId={streamId} />
    </div>
  );
}

// Shared Activity content — rendered both in the /live Activity tab and, verbatim,
// in the pop-out window so the two match exactly.
export function ActivityContent() {
  const { data: ctx, isPending } = useOverlayContext();
  const streamId = ctx?.streamId ?? null;

  if (!streamId && !isPending) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-1 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          No active broadcast — go live and this fills with chat and mod
          activity.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="shrink-0 rounded-lg border px-3 py-1.5">
        <GoalsHeader channelSlug={ctx?.channelSlug ?? ""} />
      </div>
      {streamId && <ChatPanel streamId={streamId} />}
    </div>
  );
}

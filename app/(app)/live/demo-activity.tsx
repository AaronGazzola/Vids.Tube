"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { computeGoalProgress, type Counts } from "@/lib/goals";
import { useChatAutoScroll } from "@/lib/use-chat-autoscroll";
import { cn } from "@/lib/utils";
import { ChevronDown, EllipsisVertical, Info, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useDemoGeneratorStore,
  type DemoMessage,
  type DemoViewer,
} from "./demo.stores";
import { DEMO_GOAL_TARGETS } from "./demo.types";

function initials(s: string): string {
  return s.replace(/^@/, "").slice(0, 2).toUpperCase() || "?";
}

function labelOf(v: DemoViewer | undefined): string {
  if (!v) return "viewer";
  return v.handle ? `@${v.handle}` : v.name;
}

// ── Goals header ───────────────────────────────────────────────────────────

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

function GoalsHeader({ goals }: { goals: Counts | null }) {
  const counts = useDemoGeneratorStore((s) => s.counts);
  const m = computeGoalProgress(counts, null, goals ?? DEMO_GOAL_TARGETS);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <MetricBar label="subs" current={m.subs.current} goal={m.subs.goal} pct={m.subs.pct} />
      <MetricBar label="likes" current={m.likes.current} goal={m.likes.goal} pct={m.likes.pct} />
      <MetricBar label="viewers" current={m.viewers.current} goal={m.viewers.goal} pct={m.viewers.pct} />
    </div>
  );
}

// ── Competition ────────────────────────────────────────────────────────────

type Ranked = { v: DemoViewer; total: number };

function useRanked(): Ranked[] {
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const scores = useDemoGeneratorStore((s) => s.scores);
  return useMemo(
    () =>
      viewers
        .map((v) => ({ v, total: scores[v.key]?.total ?? 0 }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total),
    [viewers, scores]
  );
}

function CompetitorBadge({ x, rank }: { x: Ranked; rank: number }) {
  const label = labelOf(x.v);
  return (
    <Badge variant="secondary" className="gap-1.5 py-1 pl-1.5 pr-2 text-xs font-normal">
      <span className="font-bold text-muted-foreground">#{rank}</span>
      <Avatar className="h-4 w-4 shrink-0">
        <AvatarImage src={x.v.avatarUrl} alt={label} />
        <AvatarFallback className="text-[8px]">{initials(label)}</AvatarFallback>
      </Avatar>
      <span className="max-w-28 truncate">{label}</span>
      <span className="font-bold tabular-nums">{x.total}</span>
    </Badge>
  );
}

function Competition() {
  const ranked = useRanked();
  const [expanded, setExpanded] = useState(false);
  const top3 = ranked.slice(0, 3);

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
      >
        <span>Competition</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>
      <div className="border-t px-3 py-2">
        {ranked.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">No scores yet.</p>
        ) : expanded ? (
          <ul>
            {ranked.map((x, i) => {
              const label = labelOf(x.v);
              return (
                <li key={x.v.key} className="flex items-center gap-2 py-1">
                  <span className="w-5 text-xs text-muted-foreground">#{i + 1}</span>
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={x.v.avatarUrl} alt={label} />
                    <AvatarFallback className="text-[9px]">{initials(label)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
                  <span className="text-xs font-bold tabular-nums">{x.total}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-2">
            {top3.map((x, i) => (
              <CompetitorBadge key={x.v.key} x={x} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────

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

function MessageMenu({ msg, viewer }: { msg: DemoMessage; viewer: DemoViewer | undefined }) {
  const hide = useDemoGeneratorStore((s) => s.hideMessage);
  const highlight = useDemoGeneratorStore((s) => s.highlightMessage);
  const ban = useDemoGeneratorStore((s) => s.banViewer);
  const [banOpen, setBanOpen] = useState(false);
  const [hidePast, setHidePast] = useState(true);
  const label = labelOf(viewer);

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
          <DropdownMenuItem onClick={() => highlight(msg.id)}>
            Highlight on overlay
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => hide(msg.id)}>Hide message</DropdownMenuItem>
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
              They&apos;ll be blocked from chatting (demo only — no real account is
              affected).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hidePast} onCheckedChange={(v) => setHidePast(v === true)} />
            Hide all their past messages in this stream
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => ban(msg.viewerKey, hidePast)}>
              Ban
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ChatRow({ msg }: { msg: DemoMessage }) {
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const unhide = useDemoGeneratorStore((s) => s.unhideMessage);
  const hide = useDemoGeneratorStore((s) => s.hideMessage);
  const highlight = useDemoGeneratorStore((s) => s.highlightMessage);
  const dismiss = useDemoGeneratorStore((s) => s.dismissMessage);
  const [revealed, setRevealed] = useState(false);
  const viewer = viewers.find((v) => v.key === msg.viewerKey);
  const label = labelOf(viewer);

  const suggested = msg.featured && !msg.promoted && !msg.dismissed;

  const author = (
    <span className="mr-1 inline-flex items-center gap-1 align-middle">
      <Avatar className="h-4 w-4">
        <AvatarImage src={viewer?.avatarUrl} alt={label} />
        <AvatarFallback className="text-[8px]">{initials(label)}</AvatarFallback>
      </Avatar>
      <span className="text-xs font-semibold">{label}</span>
    </span>
  );

  if (msg.hidden && !revealed) {
    return (
      <li>
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-[11px] italic text-muted-foreground hover:bg-muted">
              <span>Message hidden ({msg.hiddenBy ?? "owner"})</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <Button size="sm" variant="outline" className="w-full" onClick={() => setRevealed(true)}>
              Reveal
            </Button>
          </PopoverContent>
        </Popover>
      </li>
    );
  }

  if (msg.hidden && revealed) {
    return (
      <li className="rounded border border-dashed px-2 py-1 opacity-70">
        <div className="text-sm">
          {author}
          <span className="text-sm">{msg.text}</span>
        </div>
        <div className="mt-1 flex gap-2">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setRevealed(false)}>
            Hide
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => unhide(msg.id)}>
            Unhide
          </Button>
        </div>
      </li>
    );
  }

  if (suggested) {
    return (
      <li className="rounded-md border border-amber-400/50 bg-amber-400/10 p-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {author}
            <span className="mt-1 block text-sm">{msg.text}</span>
          </div>
          <MessageMenu msg={msg} viewer={viewer} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Button size="sm" className="h-6 px-2 text-xs" onClick={() => highlight(msg.id)}>
            Highlight
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => dismiss(msg.id)}
          >
            Dismiss
          </Button>
          {msg.reason && (
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
                <p className="font-semibold">Why featured · score {msg.score ?? 0}</p>
                <p className="mt-1.5 text-muted-foreground">{msg.reason}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded px-1 py-1 hover:bg-muted",
        msg.featured && "bg-muted/50"
      )}
    >
      <div className="min-w-0 flex-1">
        {author}
        <span className="text-sm">{msg.text}</span>
        {msg.featured && msg.score != null && (
          <span className="ml-1 align-middle">
            <ScoreBadge score={msg.score} reason={msg.reason} />
          </span>
        )}
      </div>
      <MessageMenu msg={msg} viewer={viewer} />
    </li>
  );
}

function ChatPanel() {
  const messages = useDemoGeneratorStore((s) => s.messages);
  const { scrollRef, contentRef, onScroll } = useChatAutoScroll(messages.length);

  return (
    <div className="flex min-h-[250px] flex-1 flex-col rounded-lg border">
      <div className="shrink-0 border-b px-3 py-2 text-sm font-semibold">Live chat</div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto p-2">
        <div ref={contentRef}>
          {!messages.length ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-1">
              {messages.map((m) => (
                <ChatRow key={m.id} msg={m} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mod bot actions ────────────────────────────────────────────────────────

function ModBotActions() {
  const mod = useDemoGeneratorStore((s) => s.mod);
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const approve = useDemoGeneratorStore((s) => s.approveMod);
  const dismiss = useDemoGeneratorStore((s) => s.dismissMod);
  const unban = useDemoGeneratorStore((s) => s.unbanViewer);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"hidden" | "banned">("hidden");

  const hidden = mod.filter((a) => a.action === "hide");
  const banned = mod.filter((a) => a.action === "ban");
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
            <p className="px-1 py-2 text-xs text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="space-y-1">
              {list.map((a) => {
                const viewer = viewers.find((v) => v.key === a.viewerKey);
                return (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{labelOf(viewer)}</span>
                      {a.body && <span className="text-muted-foreground"> “{a.body}”</span>}
                      {a.reason && (
                        <span className="block text-[10px] italic text-muted-foreground">
                          {a.reason}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        bot · {a.status}
                      </span>
                    </div>
                    {a.status === "suggested" ? (
                      <>
                        <Button
                          size="sm"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => approve(a.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-5 px-1.5 text-[10px]"
                          onClick={() => dismiss(a.id)}
                        >
                          Dismiss
                        </Button>
                      </>
                    ) : a.action === "ban" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => unban(a.viewerKey)}
                      >
                        Unban
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Activity ───────────────────────────────────────────────────────────────

export function DemoActivity({ goals }: { goals: Counts | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-3 rounded-lg border p-3">
        <GoalsHeader goals={goals} />
        <Competition />
      </div>
      <div className="shrink-0">
        <ModBotActions />
      </div>
      <ChatPanel />
    </div>
  );
}

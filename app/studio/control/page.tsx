"use client";

import { useGoalProgress } from "@/app/(overlay)/overlay/[channelSlug]/goals/page.hooks";
import { usePromotedMessages } from "@/app/(overlay)/overlay/[channelSlug]/page.hooks";
import { useLiveChat, useRequireOwner } from "@/app/layout.hooks";
import type { ViewerScoreWithAuthor } from "@/app/layout.types";
import type { OverlayContext } from "@/app/studio/overlay/page.actions";
import {
  useOverlayContext,
  useSetGoals,
  useSetScoringEnabled,
  useSetStreamYoutubeVideo,
  useStartGoals,
  useViewerLeaderboard,
} from "@/app/studio/overlay/page.hooks";
import { ChatAuthor } from "@/components/chat-author";
import { ChatText } from "@/components/chat-text";
import { type Box, DraggableResizable } from "@/components/draggable-resizable";
import { OriginBadge } from "@/components/origin-badge";
import { AvatarBubble } from "@/components/overlay/avatar-bubble";
import { GoalBar } from "@/components/overlay/goal-bar";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomToast } from "@/components/CustomToast";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { computeStandings } from "@/lib/standings";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ChevronDown, Copy, ExternalLink, FlaskConical } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

const POPOUT_SIZES: Record<string, string> = {
  all: "width=440,height=940",
  suggestions: "width=440,height=380",
  chat: "width=440,height=620",
  leaderboard: "width=380,height=560",
};

function openPopout(slug: string | undefined, panel: string) {
  if (!slug) return;
  window.open(
    `/popout/${slug}?panel=${panel}`,
    `vt-popout-${panel}`,
    POPOUT_SIZES[panel] ?? POPOUT_SIZES.all
  );
}

function PopoutButton({
  slug,
  panel,
}: {
  slug: string | undefined;
  panel: string;
}) {
  return (
    <button
      title="Pop out into its own window"
      onClick={() => openPopout(slug, panel)}
      className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </button>
  );
}
import {
  type ReasoningIdentity,
  useApproveSuggestion,
  useBanParticipant,
  useDismissSuggestion,
  useHideMessage,
  useModerationFeed,
  usePromoteHighlight,
  useReadThisQueue,
  useSetModerationMode,
  useUnbanParticipant,
  useUnhideMessage,
  useViewerReasoning,
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

function Collapsible({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="shrink-0 rounded-lg border border-white/15 bg-white/5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-white/80"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-white/10 p-3">{children}</div>}
    </div>
  );
}

function TestModeBanner() {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
      <FlaskConical className="h-4 w-4 shrink-0" />
      <span>
        <strong>Test mode</strong> — this is the dry-run stream; all data is
        simulated by <code className="font-mono">npm run dryrun</code>, not a live
        broadcast.
      </span>
    </div>
  );
}

function CopyRow({ label, url }: { label: string; url: string }) {
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.custom(() => (
      <CustomToast
        variant="success"
        title="Copied"
        message={`${label} overlay URL copied.`}
      />
    ));
  };
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          aria-label={`${label} overlay URL`}
          className="h-8 text-xs"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={copy}
          aria-label={`Copy ${label} overlay URL`}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ControlSetup({
  ctx,
  streamId,
}: {
  ctx: OverlayContext;
  streamId: string;
}) {
  const setEnabled = useSetScoringEnabled();
  const setYoutube = useSetStreamYoutubeVideo();
  const setGoals = useSetGoals();
  const startGoals = useStartGoals();

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [goalInputs, setGoalInputs] = useState<{
    subs: string;
    likes: string;
    viewers: string;
  } | null>(null);

  const goals = goalInputs ?? {
    subs: String(ctx.goals?.subs ?? 1000),
    likes: String(ctx.goals?.likes ?? 500),
    viewers: String(ctx.goals?.viewers ?? 100),
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = `${origin}/overlay/${ctx.channelSlug}`;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-2">
        <span className="text-xs font-semibold text-white/70">
          YouTube broadcast
        </span>
        <div className="flex items-center gap-2">
          <Input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder={
              ctx.youtubeVideoId
                ? `Current: ${ctx.youtubeVideoId}`
                : "YouTube video URL or id"
            }
            aria-label="YouTube video URL"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            className="h-8"
            disabled={setYoutube.isPending || !youtubeUrl.trim()}
            onClick={() => setYoutube.mutate({ streamId, urlOrId: youtubeUrl })}
          >
            Save
          </Button>
          {ctx.youtubeVideoId && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={setYoutube.isPending}
              onClick={() => {
                setYoutubeUrl("");
                setYoutube.mutate({ streamId, urlOrId: "" });
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-white/70">Featuring</span>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="h-8"
            variant={ctx.enabled ? "destructive" : "default"}
            disabled={setEnabled.isPending}
            onClick={() =>
              setEnabled.mutate({ streamId, enabled: !ctx.enabled })
            }
          >
            {ctx.enabled ? "Turn featuring off" : "Turn featuring on"}
          </Button>
          <span className="text-xs text-white/50">
            Currently {ctx.enabled ? "on" : "off"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-white/70">
          Goals (subs / likes / viewers)
        </span>
        {!ctx.youtubeVideoId ? (
          <p className="text-xs text-white/40">Set the YouTube video first.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {(["subs", "likes", "viewers"] as const).map((m) => (
                <label key={m} className="flex flex-col gap-1 text-xs">
                  <span className="capitalize text-white/50">{m}</span>
                  <Input
                    type="number"
                    min={0}
                    value={goals[m]}
                    onChange={(e) =>
                      setGoalInputs({ ...goals, [m]: e.target.value })
                    }
                    aria-label={`${m} goal`}
                    className="h-8 text-xs"
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="h-8"
                disabled={setGoals.isPending}
                onClick={() =>
                  setGoals.mutate({
                    streamId,
                    targets: {
                      subs: Number(goals.subs) || 0,
                      likes: Number(goals.likes) || 0,
                      viewers: Number(goals.viewers) || 0,
                    },
                  })
                }
              >
                Save targets
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={startGoals.isPending}
                onClick={() => startGoals.mutate({ streamId })}
              >
                {ctx.goalsStarted ? "Restart from now" : "Start"}
              </Button>
              <span className="text-xs text-white/50">
                {ctx.goalsStarted ? "tracking" : "not started"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-semibold text-white/70">
          OBS Browser Sources
        </span>
        <CopyRow label="Highlights" url={base} />
        <CopyRow label="Goals" url={`${base}/goals`} />
        <CopyRow label="Competition" url={`${base}/competition`} />
      </div>
    </div>
  );
}

const PREVIEW_BOXES: Record<string, Box> = {
  subs: { x: 12, y: 12, scale: 1 },
  likes: { x: 12, y: 70, scale: 1 },
  viewers: { x: 300, y: 12, scale: 1 },
  highlight: { x: 12, y: 250, scale: 1 },
  bubbles: { x: 16, y: 470, scale: 1 },
};

function OverlayPreview({
  streamId,
  channelSlug,
  leaderboard,
}: {
  streamId: string;
  channelSlug: string;
  leaderboard: ViewerScoreWithAuthor[];
}) {
  const [boxes, setBoxes] = useState(PREVIEW_BOXES);
  const setBox = (k: string) => (b: Box) =>
    setBoxes((s) => ({ ...s, [k]: b }));
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const { data: promoted } = usePromotedMessages(streamId);
  const { data: goalData } = useGoalProgress(channelSlug, 10);

  const standings = computeStandings(
    leaderboard.map((v) => ({ id: v.participant_key, score: v.total_score }))
  );
  const metrics = goalData?.active && goalData.metrics ? goalData.metrics : null;
  const current = promoted?.find((m) => !doneIds.has(m.id)) ?? null;
  const currentKey = current
    ? current.user_id ?? `${current.origin}:${current.external_author_id}`
    : null;
  const currentStanding =
    (currentKey && standings.get(currentKey)) || { rank: 1, progress: 0 };
  const bubbles = leaderboard.filter((v) => v.total_score > 0 && v.author).slice(0, 8);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setBoxes(PREVIEW_BOXES)}
        >
          Reset layout
        </Button>
        <span className="text-xs text-white/40">
          Live preview of this stream&apos;s OBS overlays. Drag to arrange.
        </span>
      </div>
      <div
        className="relative shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black"
        style={{ width: 405, height: 720 }}
      >
        <DraggableResizable box={boxes.highlight} onChange={setBox("highlight")}>
          <div style={{ width: 381 }}>
            {current && current.author ? (
              <HighlightedMessage
                key={current.id}
                author={current.author}
                text={current.body ?? ""}
                rank={currentStanding.rank}
                progress={currentStanding.progress}
                size={56}
                onDone={() =>
                  setDoneIds((p) => new Set(p).add(current.id))
                }
              />
            ) : (
              <div className="rounded-xl border border-dashed border-white/40 px-3 py-5 text-center text-xs text-white/50">
                Promote a highlight to see it here
              </div>
            )}
          </div>
        </DraggableResizable>

        {metrics && (
          <>
            <DraggableResizable box={boxes.subs} onChange={setBox("subs")}>
              <GoalBar metric="subs" data={metrics.subs} height={140} />
            </DraggableResizable>
            <DraggableResizable box={boxes.likes} onChange={setBox("likes")}>
              <GoalBar metric="likes" data={metrics.likes} height={140} />
            </DraggableResizable>
            <DraggableResizable box={boxes.viewers} onChange={setBox("viewers")}>
              <GoalBar metric="viewers" data={metrics.viewers} height={160} />
            </DraggableResizable>
          </>
        )}

        <DraggableResizable box={boxes.bubbles} onChange={setBox("bubbles")}>
          <div className="relative" style={{ width: 360, height: 200 }}>
            {bubbles.map((v, i) => {
              if (!v.author) return null;
              const st = standings.get(v.participant_key) ?? {
                rank: i + 1,
                progress: 0,
              };
              return (
                <div
                  key={v.participant_key}
                  className="absolute"
                  style={{
                    left: `${4 + ((i * 37) % 80)}%`,
                    bottom: `${6 + ((i * 53) % 60)}%`,
                  }}
                >
                  <AvatarBubble
                    author={v.author}
                    progress={st.progress}
                    rank={st.rank}
                    size={56}
                  />
                </div>
              );
            })}
          </div>
        </DraggableResizable>
      </div>
    </div>
  );
}

function LeaderboardRow({
  v,
  rank,
  streamId,
  ban,
}: {
  v: ViewerScoreWithAuthor;
  rank: number;
  streamId: string | null;
  ban: ReturnType<typeof useBanParticipant>;
}) {
  const [open, setOpen] = useState(false);
  const label = v.author?.handle
    ? `@${v.author.handle}`
    : v.author?.name ?? "viewer";
  const url =
    (v.author?.avatarUrl ?? channelAssetUrl(v.author?.avatarPath ?? null)) ||
    placeholderAvatar(v.author?.handle ?? v.author?.name);
  const identity: ReasoningIdentity = {
    participantKey: v.participant_key,
    userId: v.user_id,
    origin: v.origin,
    externalAuthorId: v.external_author_id,
  };
  const { data: reasoning, isFetching } = useViewerReasoning(
    streamId,
    identity,
    open
  );

  return (
    <li className="rounded">
      <div className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-white/5">
        <span className="w-4 text-xs text-white/40">{rank}</span>
        <Avatar className="h-5 w-5 shrink-0">
          {url && <AvatarImage src={url} alt={label} />}
          <AvatarFallback className="text-[9px]">
            {initials(label)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-xs">{label}</span>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Why this score?"
          className={cn(
            "rounded px-1 text-[10px]",
            open ? "text-white" : "text-white/40 hover:text-white"
          )}
        >
          why?
        </button>
        <span className="text-xs font-bold tabular-nums">{v.total_score}</span>
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
      </div>
      {open && (
        <div className="mb-1 ml-6 mt-1 space-y-1 rounded-md border border-white/10 bg-white/5 p-2 text-[11px]">
          {isFetching && !reasoning ? (
            <Skeleton className="h-10 w-full" />
          ) : !reasoning?.items.length ? (
            <p className="text-white/40">No scored messages yet.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {reasoning.items.map((it, idx) => (
                  <li key={idx} className="border-b border-white/5 pb-1 last:border-0">
                    <p className="truncate text-white/70">“{it.text}”</p>
                    <div className="flex gap-2 text-white/50">
                      <span>eng {it.engagement}</span>
                      <span>hum {it.humour}</span>
                      <span>con {it.contribution}</span>
                      <span className="ml-auto font-semibold text-white/70">
                        +{it.points}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {!!reasoning.featureReasons.length && (
                <div className="pt-1">
                  <p className="text-white/40">Featured because:</p>
                  {reasoning.featureReasons.map((r, i) => (
                    <p key={i} className="italic text-amber-200/70">
                      {r}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
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

  const promote = usePromoteHighlight(streamId);
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
    .filter((m) => !m.promoted_at && !dismissed.has(m.id))
    .slice()
    .reverse();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 overflow-y-auto bg-neutral-950 p-3 text-white">
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => openPopout(ctx?.channelSlug, "all")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Pop out
          </Button>
        )}
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

      {ctx?.streamTitle?.startsWith("[DRY RUN]") && <TestModeBanner />}

      <Collapsible title="Setup">
        {streamId && ctx ? (
          <ControlSetup ctx={ctx} streamId={streamId} />
        ) : (
          <p className="text-xs text-white/40">
            No broadcast yet — start your encoder first.
          </p>
        )}
      </Collapsible>

      <Collapsible title="Overlay preview">
        {streamId && ctx ? (
          <OverlayPreview
            streamId={streamId}
            channelSlug={ctx.channelSlug}
            leaderboard={leaderboard ?? []}
          />
        ) : (
          <p className="text-xs text-white/40">
            Go live or run <code className="font-mono">npm run dryrun</code> to
            populate the preview.
          </p>
        )}
      </Collapsible>

      {!streamId && !ctxPending ? (
        <div className="flex min-h-75 flex-1 items-center justify-center rounded-lg border border-white/15 text-sm text-white/50">
          No broadcast yet — go live, then this fills with chat and AI picks.
        </div>
      ) : (
        <div className="grid min-h-130 flex-1 gap-3 lg:grid-cols-[1fr_1fr_0.9fr]">
          <Panel
            title="Read this (AI picks)"
            right={<PopoutButton slug={ctx?.channelSlug} panel="suggestions" />}
          >
            {readPending && streamId ? (
              <Skeleton className="h-16 w-full" />
            ) : queue.length === 0 ? (
              <p className="px-1 py-2 text-xs text-white/40">
                Nothing featured yet.
              </p>
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
                        <Button
                          size="sm"
                          disabled={promote.isPending}
                          className="ml-auto h-6 px-2 text-xs"
                          onClick={() => promote.mutate(m.id)}
                        >
                          Show on overlay
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Dismiss"
                          className="h-6 px-1.5 text-xs text-white/40"
                          onClick={() =>
                            setDismissed((prev) => new Set(prev).add(m.id))
                          }
                        >
                          ✕
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

          <Panel
            title="Live chat"
            right={<PopoutButton slug={ctx?.channelSlug} panel="chat" />}
          >
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
                      <ChatText text={m.body} className="text-sm" />
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
            <Panel
              title="Leaderboard"
              right={<PopoutButton slug={ctx?.channelSlug} panel="leaderboard" />}
            >
              {lbPending && streamId ? (
                <Skeleton className="h-16 w-full" />
              ) : !leaderboard?.length ? (
                <p className="px-1 py-2 text-xs text-white/40">No scores yet.</p>
              ) : (
                <ul className="space-y-1">
                  {leaderboard.map((v, i) => (
                    <LeaderboardRow
                      key={v.participant_key}
                      v={v}
                      rank={i + 1}
                      streamId={streamId}
                      ban={ban}
                    />
                  ))}
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
                      className="flex items-start gap-2 rounded border border-white/10 px-2 py-1.5 text-xs"
                    >
                      <span
                        className={cn(
                          "mt-0.5 rounded px-1 font-semibold uppercase",
                          a.action === "ban"
                            ? "bg-red-600/30 text-red-200"
                            : "bg-amber-500/20 text-amber-200"
                        )}
                      >
                        {a.action}
                      </span>
                      <div className="min-w-0 flex-1">
                        <OriginBadge origin={a.origin} className="mr-1" />
                        <span className="font-semibold text-white/80">
                          {a.sender}
                        </span>
                        {a.body && (
                          <span className="text-white/70"> “{a.body}”</span>
                        )}
                        {a.reason && (
                          <span className="block text-[10px] italic text-white/40">
                            {a.reason}
                          </span>
                        )}
                      </div>
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

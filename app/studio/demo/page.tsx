"use client";

import { useRequireOwner } from "@/app/layout.hooks";
import type { FeaturedAuthor } from "@/app/layout.types";
import {
  type Box,
  DraggableResizable,
} from "@/components/draggable-resizable";
import { AvatarBubble } from "@/components/overlay/avatar-bubble";
import { GoalBar } from "@/components/overlay/goal-bar";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { type Counts, computeGoalProgress } from "@/lib/goals";
import { placeholderAvatar } from "@/lib/placeholder-avatar";
import { computeStandings } from "@/lib/standings";
import { vodAssetUrl } from "@/lib/storage";
import { useState } from "react";
import { useOwnerVideos } from "./page.hooks";

type Viewer = {
  id: string;
  author: FeaturedAuthor;
  score: number;
  message: string;
};

const photo = (seed: string) => placeholderAvatar(seed);

const INITIAL_VIEWERS: Viewer[] = [
  { id: "1", author: { name: "pixelpup", handle: "pixelpup", avatarUrl: photo("pixelpup"), avatarPath: null }, score: 8, message: "this stream is unreal lol" },
  { id: "2", author: { name: "nightowl", handle: "nightowl", avatarUrl: photo("nightowl"), avatarPath: null }, score: 5, message: "how did you do that?!" },
  { id: "3", author: { name: "GamerGodX", handle: null, avatarUrl: photo("gamergodx"), avatarPath: null }, score: 12, message: "first try?? insane" },
  { id: "4", author: { name: "chatlegend", handle: null, avatarUrl: photo("chatlegend"), avatarPath: null }, score: 3, message: "W stream" },
  { id: "5", author: { name: "sunny_dev", handle: "sunny_dev", avatarUrl: photo("sunnydev"), avatarPath: null }, score: 6, message: "the goal is so close!" },
  { id: "6", author: { name: "QuietViewer", handle: null, avatarUrl: photo("quietviewer"), avatarPath: null }, score: 1, message: "hi everyone" },
];

const DEFAULT_BOXES: Record<string, Box> = {
  subs: { x: 12, y: 12, scale: 1 },
  likes: { x: 12, y: 70, scale: 1 },
  viewers: { x: 300, y: 12, scale: 1 },
  highlight: { x: 12, y: 250, scale: 1 },
  bubbles: { x: 16, y: 470, scale: 1 },
};

const GOALS = ["subs", "likes", "viewers"] as const;

export default function DemoPage() {
  const { isPending, isOwner } = useRequireOwner();
  const { data: videos } = useOwnerVideos();

  const [videoId, setVideoId] = useState("");
  const [viewers, setViewers] = useState<Viewer[]>(INITIAL_VIEWERS);
  const [counts, setCounts] = useState<Counts>({ subs: 950, likes: 120, viewers: 40 });
  const [goals, setGoals] = useState<Counts>({ subs: 1000, likes: 200, viewers: 100 });
  const [baseline, setBaseline] = useState<Counts | null>(null);
  const [queue, setQueue] = useState<{ id: string; author: FeaturedAuthor; text: string; rank: number; progress: number }[]>([]);
  const [boxes, setBoxes] = useState(DEFAULT_BOXES);
  const [bubbleOpacity, setBubbleOpacity] = useState(0.7);
  const [goalsComplete, setGoalsComplete] = useState(false);

  const selected = videos?.find((v) => v.id === videoId) ?? videos?.[0];
  const src = vodAssetUrl(selected?.mp4_path ?? null);
  const metrics = computeGoalProgress(counts, baseline, goals);
  const shownMetrics = goalsComplete
    ? (Object.fromEntries(
        GOALS.map((m) => [
          m,
          { current: goals[m], target: goals[m], total: goals[m], goal: goals[m], pct: 100, reached: true },
        ])
      ) as typeof metrics)
    : metrics;
  const standings = computeStandings(viewers.map((v) => ({ id: v.id, score: v.score })));
  const current = queue[0] ?? null;

  function highlight(v: Viewer) {
    const st = standings.get(v.id) ?? { rank: 1, progress: 0 };
    setQueue((q) => [
      ...q,
      { id: crypto.randomUUID(), author: v.author, text: v.message, rank: st.rank, progress: st.progress },
    ]);
  }

  function bump(v: Viewer, delta: number) {
    setViewers((vs) =>
      vs.map((x) => (x.id === v.id ? { ...x, score: Math.max(0, x.score + delta) } : x))
    );
  }

  if (isPending || !isOwner) {
    return <Skeleton className="h-180 w-full" />;
  }

  const labelOf = (a: FeaturedAuthor) => (a.handle ? `@${a.handle}` : a.name);
  const setBox = (k: string) => (b: Box) => setBoxes((s) => ({ ...s, [k]: b }));
  const active = viewers.filter((v) => v.score > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">Overlay demo</h1>
        <select
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="ml-auto rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{videos?.length ? "Latest VOD" : "No VODs"}</option>
          {videos?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title ?? v.id}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => setBoxes(DEFAULT_BOXES)}>
          Reset layout
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setViewers(INITIAL_VIEWERS);
            setBaseline(null);
            setQueue([]);
          }}
        >
          Reset sim
        </Button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Bubble opacity
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={bubbleOpacity}
            onChange={(e) => setBubbleOpacity(Number(e.target.value))}
          />
        </label>
      </div>

      <p className="text-sm text-muted-foreground">
        Portrait stage with each overlay element placed independently (as separate
        OBS sources). Everything is simulated — it shows how the overlays look and
        behave, not whether the AI would pick those messages or scores.
      </p>

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <div
          className="relative shrink-0 overflow-hidden rounded-lg border bg-black"
          style={{ width: 405, height: 720 }}
        >
          {src ? (
            <video
              key={src}
              src={src}
              controls
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
              Select a VOD to play behind the overlays.
            </div>
          )}

          <DraggableResizable box={boxes.highlight} onChange={setBox("highlight")}>
            <div style={{ width: 381 }}>
              {current ? (
                <HighlightedMessage
                  key={current.id}
                  author={current.author}
                  text={current.text}
                  rank={current.rank}
                  progress={current.progress}
                  size={56}
                  onDone={() => setQueue((q) => q.slice(1))}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-white/40 px-3 py-5 text-center text-xs text-white/50">
                  Highlighted message appears here
                </div>
              )}
            </div>
          </DraggableResizable>

          <DraggableResizable box={boxes.subs} onChange={setBox("subs")}>
            <GoalBar metric="subs" data={shownMetrics.subs} height={140} />
          </DraggableResizable>
          <DraggableResizable box={boxes.likes} onChange={setBox("likes")}>
            <GoalBar metric="likes" data={shownMetrics.likes} height={140} />
          </DraggableResizable>
          <DraggableResizable box={boxes.viewers} onChange={setBox("viewers")}>
            <GoalBar metric="viewers" data={shownMetrics.viewers} height={160} />
          </DraggableResizable>

          <DraggableResizable box={boxes.bubbles} onChange={setBox("bubbles")}>
            <div
              className="relative"
              style={{ width: 360, height: 200, opacity: bubbleOpacity }}
            >
              {active.map((v, i) => {
                const st = standings.get(v.id) ?? { rank: i + 1, progress: 0 };
                return (
                  <div
                    key={v.id}
                    className="absolute"
                    style={{
                      left: `${4 + ((i * 37) % 80)}%`,
                      bottom: `${6 + ((i * 53) % 60)}%`,
                      animation: `bubble-float ${6 + (i % 5)}s ease-in-out ${(i % 7) * 0.6}s infinite`,
                    }}
                  >
                    <AvatarBubble author={v.author} progress={st.progress} rank={st.rank} size={56} />
                  </div>
                );
              })}
            </div>
          </DraggableResizable>
        </div>

        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chat → highlight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {viewers.map((v) => (
                <div key={v.id} className="space-y-1 rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{labelOf(v.author)}</span>
                    <Button size="sm" onClick={() => highlight(v)}>
                      Highlight
                    </Button>
                  </div>
                  <Input
                    value={v.message}
                    onChange={(e) =>
                      setViewers((vs) =>
                        vs.map((x) => (x.id === v.id ? { ...x, message: e.target.value } : x))
                      )
                    }
                    aria-label={`${labelOf(v.author)} message`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Competition scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {viewers.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {labelOf(v.author)}{" "}
                      <span className="text-muted-foreground">
                        #{standings.get(v.id)?.rank} · {v.score}
                      </span>
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => bump(v, -2)}>
                        −
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => bump(v, 3)}>
                        +
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  Goals (now / target)
                  <Button
                    size="sm"
                    variant={goalsComplete ? "default" : "outline"}
                    onClick={() => setGoalsComplete((v) => !v)}
                  >
                    {goalsComplete ? "Complete" : "In progress"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {GOALS.map((m) => (
                  <div key={m} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-sm">
                    <span className="capitalize">{m}</span>
                    <Input
                      type="number"
                      value={counts[m]}
                      onChange={(e) => setCounts((c) => ({ ...c, [m]: Number(e.target.value) || 0 }))}
                      aria-label={`${m} now`}
                    />
                    <Input
                      type="number"
                      value={goals[m]}
                      onChange={(e) => setGoals((g) => ({ ...g, [m]: Number(e.target.value) || 0 }))}
                      aria-label={`${m} target`}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setBaseline({ ...counts })}>
                    Start (snapshot)
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {baseline ? "tracking" : "not started"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

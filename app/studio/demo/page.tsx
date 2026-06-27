"use client";

import { useRequireOwner } from "@/app/layout.hooks";
import type { FeaturedAuthor } from "@/app/layout.types";
import {
  type Box,
  DraggableResizable,
} from "@/components/draggable-resizable";
import { FeaturedAvatar } from "@/components/overlay/featured-avatar";
import { GoalBar } from "@/components/overlay/goal-bar";
import { Plant } from "@/components/overlay/plant";
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
import { vodAssetUrl } from "@/lib/storage";
import { useState } from "react";
import { useOwnerVideos } from "./page.hooks";

type Viewer = {
  id: string;
  author: FeaturedAuthor;
  score: number;
  features: number;
};

const dice = (seed: string, style: string) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

const INITIAL_VIEWERS: Viewer[] = [
  { id: "1", author: { name: "pixelpup", handle: "pixelpup", avatarUrl: dice("pixelpup", "bottts"), avatarPath: null }, score: 8, features: 1 },
  { id: "2", author: { name: "nightowl", handle: "nightowl", avatarUrl: dice("nightowl", "bottts"), avatarPath: null }, score: 5, features: 0 },
  { id: "3", author: { name: "GamerGodX", handle: null, avatarUrl: dice("GamerGodX", "funEmoji"), avatarPath: null }, score: 12, features: 2 },
  { id: "4", author: { name: "chatlegend", handle: null, avatarUrl: dice("chatlegend", "funEmoji"), avatarPath: null }, score: 3, features: 0 },
  { id: "5", author: { name: "sunny_dev", handle: "sunny_dev", avatarUrl: dice("sunny", "bottts"), avatarPath: null }, score: 6, features: 1 },
  { id: "6", author: { name: "QuietViewer", handle: null, avatarUrl: dice("Quiet", "funEmoji"), avatarPath: null }, score: 1, features: 0 },
];

const DEFAULT_BOXES = {
  goals: { x: 24, y: 24, scale: 1 },
  competition: { x: 24, y: 320, scale: 0.85 },
};

const METRICS = ["subs", "likes", "viewers"] as const;

export default function DemoPage() {
  const { isPending, isOwner } = useRequireOwner();
  const { data: videos } = useOwnerVideos();

  const [videoId, setVideoId] = useState("");
  const [viewers, setViewers] = useState<Viewer[]>(INITIAL_VIEWERS);
  const [counts, setCounts] = useState<Counts>({ subs: 950, likes: 120, viewers: 40 });
  const [goals, setGoals] = useState<Counts>({ subs: 1000, likes: 200, viewers: 100 });
  const [baseline, setBaseline] = useState<Counts | null>(null);
  const [queue, setQueue] = useState<{ id: string; author: FeaturedAuthor; ringLevel: number }[]>([]);
  const [boxes, setBoxes] = useState(DEFAULT_BOXES);

  const selected = videos?.find((v) => v.id === videoId) ?? videos?.[0];
  const src = vodAssetUrl(selected?.mp4_path ?? null);
  const metrics = computeGoalProgress(counts, baseline, goals);
  const topScore = Math.max(1, ...viewers.map((v) => v.score));
  const current = queue[0] ?? null;

  function featureViewer(v: Viewer) {
    const ringLevel = v.features + 1;
    setViewers((vs) =>
      vs.map((x) => (x.id === v.id ? { ...x, features: x.features + 1 } : x))
    );
    setQueue((q) => [
      ...q,
      { id: crypto.randomUUID(), author: v.author, ringLevel },
    ]);
  }

  function bump(v: Viewer, delta: number) {
    setViewers((vs) =>
      vs.map((x) =>
        x.id === v.id ? { ...x, score: Math.max(0, x.score + delta) } : x
      )
    );
  }

  if (isPending || !isOwner) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  const label = (a: FeaturedAuthor) => (a.handle ? `@${a.handle}` : a.name);

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
      </div>

      <p className="text-sm text-muted-foreground">
        Plays a past VOD with the real overlays on top. Goals and Competition are
        draggable/resizable; Highlights travel across the stage as they do live.
        Everything here is simulated — it verifies the visuals, not the AI&apos;s
        scoring decisions.
      </p>

      <div
        className="relative w-full overflow-hidden rounded-lg border bg-black"
        style={{ height: 600 }}
      >
        {src ? (
          <video
            key={src}
            src={src}
            controls
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
            Select a VOD to play behind the overlays.
          </div>
        )}

        {current && (
          <div className="pointer-events-none absolute inset-0">
            <FeaturedAvatar
              key={current.id}
              author={current.author}
              ringLevel={current.ringLevel}
              onDone={() => setQueue((q) => q.slice(1))}
            />
          </div>
        )}

        <DraggableResizable
          box={boxes.goals}
          onChange={(b: Box) => setBoxes((s) => ({ ...s, goals: b }))}
        >
          <div className="flex items-end gap-6">
            {METRICS.map((m) => (
              <GoalBar key={m} metric={m} data={metrics[m]} height={200} />
            ))}
          </div>
        </DraggableResizable>

        <DraggableResizable
          box={boxes.competition}
          onChange={(b: Box) => setBoxes((s) => ({ ...s, competition: b }))}
        >
          <div className="flex items-end gap-3">
            {viewers.map((v) => (
              <Plant
                key={v.id}
                author={v.author}
                score={v.score}
                topScore={topScore}
                featuresCount={v.features}
                maxHeight={200}
              />
            ))}
          </div>
        </DraggableResizable>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {viewers.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {label(v.author)}{" "}
                  <span className="text-muted-foreground">({v.features} rings)</span>
                </span>
                <Button size="sm" onClick={() => featureViewer(v)}>
                  Feature
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Competition scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {viewers.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {label(v.author)}{" "}
                  <span className="text-muted-foreground">score {v.score}</span>
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
            <CardTitle className="text-base">Goals (now / target)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {METRICS.map((m) => (
              <div key={m} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-sm">
                <span className="capitalize">{m}</span>
                <Input
                  type="number"
                  value={counts[m]}
                  onChange={(e) =>
                    setCounts((c) => ({ ...c, [m]: Number(e.target.value) || 0 }))
                  }
                  aria-label={`${m} now`}
                />
                <Input
                  type="number"
                  value={goals[m]}
                  onChange={(e) =>
                    setGoals((g) => ({ ...g, [m]: Number(e.target.value) || 0 }))
                  }
                  aria-label={`${m} target`}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setBaseline({ ...counts })}>
                Start (snapshot)
              </Button>
              <span className="text-xs text-muted-foreground">
                {baseline ? "tracking from baseline" : "not started"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

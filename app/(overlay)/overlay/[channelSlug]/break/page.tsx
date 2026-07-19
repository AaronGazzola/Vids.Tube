"use client";

import { OverlayBoxFrame } from "@/components/overlay/box-frame";
import { BreakCard } from "@/components/overlay/break-card";
import { use, useState } from "react";
import { useDemoOverlaySnapshot, useOverlayLayout } from "../page.hooks";
import { useBreakState } from "./page.hooks";

const DEMO_BREAK_MS = 5 * 60_000;

function DemoBreak() {
  const [endsAt, setEndsAt] = useState(() => Date.now() + DEMO_BREAK_MS);
  return (
    <BreakCard
      endsAt={endsAt}
      onDone={() => setEndsAt(Date.now() + DEMO_BREAK_MS)}
    />
  );
}

export default function BreakOverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const snapshot = useDemoOverlaySnapshot(channelSlug);
  const { data: layout } = useOverlayLayout(channelSlug);
  const breakQuery = useBreakState(channelSlug);

  if (snapshot) {
    if (!snapshot.visible.break) {
      return null;
    }
    return (
      <OverlayBoxFrame scale={snapshot.boxes.break.scale}>
        <DemoBreak />
      </OverlayBoxFrame>
    );
  }

  const breakEndsAt = breakQuery.data?.breakEndsAt ?? null;

  // BreakCard renders nothing once the timer has elapsed, so a stale
  // timestamp from an earlier break stays invisible.
  if (breakEndsAt) {
    return (
      <OverlayBoxFrame scale={layout?.boxes.break.scale ?? 1}>
        <BreakCard key={breakEndsAt} endsAt={breakEndsAt} />
      </OverlayBoxFrame>
    );
  }

  return null;
}

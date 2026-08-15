"use client";

import type { DemoBoxKey } from "@/app/(app)/live/demo.types";
import { GOAL_METRICS } from "@/app/layout.types";
import { CompetitionLadder } from "@/components/overlay/competition-ladder";
import { GameWindow } from "@/components/overlay/game-window";
import { GoalBar } from "@/components/overlay/goal-bar";
import { MessageBanner } from "@/components/overlay/message-banner";
import { OverlayScaleProvider } from "@/components/overlay/overlay-scale-context";
import type { OverlayStageProps } from "@/components/overlay/overlay-stage.types";
import {
  GOAL_METRIC_BOX,
  OVERLAY_BASE_DIMS,
  OVERLAY_CANVAS_H,
  OVERLAY_CANVAS_W,
  OVERLAY_FEED_WIDTH,
  OVERLAY_GOAL_HEIGHT,
  OVERLAY_LADDER_SIZE,
  type OverlayBox,
} from "@/lib/demo-overlay";
import type { ReactNode } from "react";

function Positioned({
  boxKey,
  box,
  opacity = 1,
  children,
}: {
  boxKey: DemoBoxKey;
  box: OverlayBox;
  opacity?: number;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={`overlay-box-${boxKey}`}
      className="absolute"
      style={
        {
          left: box.x,
          top: box.y,
          // Drives the black backing of whatever sits inside, not the box as a
          // whole: fading the element took the text with it, so a subtle overlay
          // was also an unreadable one.
          "--overlay-bg-opacity": opacity,
          transform: `scale(${box.scale})`,
          transformOrigin: "top left",
        } as React.CSSProperties
      }
    >
      <OverlayScaleProvider scale={box.scale}>{children}</OverlayScaleProvider>
    </div>
  );
}

// The dashed outline stands in for the shared feed slot while it is empty, so
// the slot can be positioned before anything has played through it. The OBS
// route renders nothing when idle, so the audience never sees a placeholder.
function FeedPlaceholder() {
  return (
    <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-white/60 text-sm font-medium text-white/80">
      Highlight
    </div>
  );
}

export function OverlayStage({
  config,
  boxes,
  visible,
  surface,
  values,
  wrapBox,
  resizeMode = false,
}: OverlayStageProps) {
  const wrap = (boxKey: DemoBoxKey, node: ReactNode) =>
    wrapBox ? wrapBox(boxKey, node) : node;

  // The composer exists to show what is there, including nothing: an empty
  // leaderboard is a fact worth seeing and positioning. The audience must never
  // be shown an empty frame, so the same values render differently there.
  const renderEmpty = surface === "composer";
  const showFeedPlaceholder = renderEmpty && resizeMode && !values.feedSlotFilled;

  return (
    <div
      className={
        surface === "obs"
          ? "fixed left-0 top-0 overflow-hidden"
          : "absolute left-0 top-0"
      }
      style={{ width: OVERLAY_CANVAS_W, height: OVERLAY_CANVAS_H }}
    >
      {values.feedVisible && (
        <Positioned boxKey="highlight" box={boxes.highlight} opacity={config.boxOpacity.highlight}>
          <div style={{ width: OVERLAY_FEED_WIDTH }}>
            {wrap(
              "highlight",
              showFeedPlaceholder ? <FeedPlaceholder /> : values.feedSlot
            )}
          </div>
        </Positioned>
      )}

      {visible.messageBanner && (
        <Positioned boxKey="messageBanner" box={boxes.messageBanner} opacity={config.boxOpacity.messageBanner}>
          {wrap(
            "messageBanner",
            <MessageBanner
              metrics={values.bannerMetrics}
              messages={config.messages}
            />
          )}
        </Positioned>
      )}

      {GOAL_METRICS.map((metric) => {
        const boxKey = GOAL_METRIC_BOX[metric];
        const data = visible[boxKey] ? values.goalMetric(metric) : null;
        if (!data) return null;
        return (
          <Positioned
            key={metric}
            boxKey={boxKey}
            box={boxes[boxKey]}
            opacity={config.boxOpacity[boxKey]}
          >
            {wrap(
              boxKey,
              <GoalBar
                metric={metric}
                data={data}
                height={OVERLAY_GOAL_HEIGHT}
              />
            )}
          </Positioned>
        );
      })}

      {visible.competition &&
        (renderEmpty || values.competitionEntries.length > 0) && (
        <Positioned
          boxKey="competition"
          box={boxes.competition}
          opacity={config.boxOpacity.competition}
        >
          {wrap(
            "competition",
            <CompetitionLadder
              entries={values.competitionEntries}
              size={OVERLAY_LADDER_SIZE}
            />
          )}
        </Positioned>
      )}

      {visible.game && (
        <Positioned boxKey="game" box={boxes.game} opacity={config.boxOpacity.game}>
          {wrap(
            "game",
            <GameWindow
              installation={values.gameInstallation}
              // The stage is what knows the box, so it is the stage that tells
              // the overlay how much room it has. The scale is the half a frame
              // cannot measure for itself.
              box={{
                width: OVERLAY_BASE_DIMS.game.w,
                height: OVERLAY_BASE_DIMS.game.h,
                scale: boxes.game.scale,
              }}
            />
          )}
        </Positioned>
      )}

      {values.breakSlot && (
        <Positioned boxKey="break" box={boxes.break} opacity={config.boxOpacity.break}>
          {wrap("break", values.breakSlot)}
        </Positioned>
      )}
    </div>
  );
}

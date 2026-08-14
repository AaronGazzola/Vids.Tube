import type { DemoBoxKey, DemoLayoutConfig } from "@/app/(app)/live/demo.types";
import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import type { CompetitionEntry } from "@/components/overlay/competition-ladder";
import type { BannerMetricValues } from "@/lib/banner-metrics";
import type { OverlayBox } from "@/lib/demo-overlay";
import type { OverlayInstallation } from "@/lib/overlay-frame";
import type { ReactNode } from "react";

export type OverlayStageSurface = "obs" | "composer";

export type OverlayStageValues = {
  feedVisible: boolean;
  feedSlot: ReactNode;
  feedSlotFilled: boolean;
  // Every banner metric, resolved once per surface so the OBS route and the
  // Overlays tab cannot arrive at different numbers.
  bannerMetrics: BannerMetricValues;
  goalMetric: (metric: GoalMetric) => MetricProgress | null;
  competitionEntries: CompetitionEntry[];
  breakSlot: ReactNode | null;
  // The overlay this channel installed in the game box. Three states, not two:
  // undefined while the answer is still being fetched, null once it is known
  // that nothing is installed. Collapsing them makes every page load report an
  // empty box that is merely a slow one.
  gameInstallation: OverlayInstallation | null | undefined;
};

export type OverlayStageProps = {
  config: DemoLayoutConfig;
  boxes: Record<DemoBoxKey, OverlayBox>;
  visible: Record<string, boolean>;
  surface: OverlayStageSurface;
  values: OverlayStageValues;
  wrapBox?: (boxKey: DemoBoxKey, node: ReactNode) => ReactNode;
  // Only the composer draws the idle placeholder, and only while the owner is
  // positioning things. The audience surface never draws it at all.
  resizeMode?: boolean;
};

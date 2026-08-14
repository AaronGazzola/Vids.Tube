import type { DemoBoxKey, DemoLayoutConfig } from "@/app/(app)/live/demo.types";
import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import type { CompetitionEntry } from "@/components/overlay/competition-ladder";
import type { BannerMetricValues } from "@/lib/banner-metrics";
import type { OverlayBox } from "@/lib/demo-overlay";
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

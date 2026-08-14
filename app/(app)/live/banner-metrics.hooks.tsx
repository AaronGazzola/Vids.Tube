"use client";

import { useGoalProgress } from "@/app/(overlay)/overlay/[channelSlug]/goals/page.hooks";
import {
  useBannerCounts,
  useMemberCount,
} from "@/app/(overlay)/overlay/[channelSlug]/page.hooks";
import { resolveBannerMetrics, type BannerMetricValues } from "@/lib/banner-metrics";

// One place the banner's numbers come from, used by the OBS route, the Overlays
// tab and the settings editor alike. The editor draws the same figures a viewer
// would see — and the same absences — because a fabricated number is a layout
// judged against something that will never appear.
export function useBannerMetricValues(channelSlug: string): BannerMetricValues {
  const { data: goals } = useGoalProgress(channelSlug, 10, true);
  const { data: memberCount } = useMemberCount(channelSlug);
  const { data: counts } = useBannerCounts(channelSlug);

  return resolveBannerMetrics({
    goals,
    memberCount,
    totalChatters: counts?.totalChatters,
    chatsThisStream: counts?.chatsThisStream,
    commandsThisStream: counts?.commandsThisStream,
    newMembersThisStream: counts?.newMembersThisStream,
  });
}

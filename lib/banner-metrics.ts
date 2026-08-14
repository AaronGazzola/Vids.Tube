import type { BannerMetricKind } from "@/app/(app)/live/demo.types";
import type { GoalProgressResponse } from "@/app/layout.types";

export type BannerCountSources = {
  goals: GoalProgressResponse | null | undefined;
  memberCount: number | null | undefined;
  totalChatters: number | null | undefined;
  chatsThisStream: number | null | undefined;
  commandsThisStream: number | null | undefined;
  newMembersThisStream: number | null | undefined;
};

export type BannerMetricValues = Record<BannerMetricKind, number | null>;

// Null means "there is no such number right now", and the banner draws nothing
// rather than a zero. Off air there is no viewer count and no likes for this
// stream; a zero would be a claim, and absence is the truth.
//
// A kind naming "this stream" reads the live broadcast. One that does not reads
// the channel's lifetime figure and survives being off air.
export function resolveBannerMetrics(
  sources: BannerCountSources
): BannerMetricValues {
  const { goals } = sources;
  const live = Boolean(goals?.active && goals.metrics);
  const metrics = goals?.metrics ?? null;

  const num = (value: number | null | undefined) =>
    typeof value === "number" ? value : null;

  return {
    // The channel's own total, which the goal action fetches whether or not a
    // goal is running.
    totalSubs: live && metrics ? metrics.subs.total : null,
    // The gain since this broadcast started, which is what the goal bar shows.
    newSubsThisStream: live && metrics ? metrics.subs.current : null,
    likesThisStream: live && metrics ? metrics.likes.current : null,
    currentViewers: live && metrics ? metrics.viewers.current : null,
    totalChatters: num(sources.totalChatters),
    chatsThisStream: num(sources.chatsThisStream),
    commandsThisStream: num(sources.commandsThisStream),
    members: num(sources.memberCount),
    newMembersThisStream: num(sources.newMembersThisStream),
  };
}

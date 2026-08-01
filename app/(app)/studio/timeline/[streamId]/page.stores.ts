import type { ScoreCriterion } from "@/app/(app)/studio/timeline/[streamId]/page.types";
import { create } from "zustand";

type TimelineViewState = {
  sortBy: ScoreCriterion;
  minScore: number;
  tag: string | null;
  setSortBy: (criterion: ScoreCriterion) => void;
  setMinScore: (value: number) => void;
  setTag: (tag: string | null) => void;
  reset: () => void;
};

export const useTimelineViewStore = create<TimelineViewState>((set) => ({
  sortBy: "interest",
  minScore: 0,
  tag: null,
  setSortBy: (sortBy) => set({ sortBy }),
  setMinScore: (minScore) => set({ minScore }),
  setTag: (tag) => set({ tag }),
  reset: () => set({ sortBy: "interest", minScore: 0, tag: null }),
}));

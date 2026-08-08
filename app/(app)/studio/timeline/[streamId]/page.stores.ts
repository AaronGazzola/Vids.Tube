import type {
  ScoreCriterion,
  TimelineOrder,
} from "@/app/(app)/studio/timeline/[streamId]/page.types";
import { create } from "zustand";

type TimelineViewState = {
  sortBy: ScoreCriterion;
  minScore: number;
  order: TimelineOrder;
  setSortBy: (criterion: ScoreCriterion) => void;
  setMinScore: (value: number) => void;
  setOrder: (order: TimelineOrder) => void;
  reset: () => void;
};

export const useTimelineViewStore = create<TimelineViewState>((set) => ({
  sortBy: "interest",
  minScore: 0,
  order: "score",
  setSortBy: (sortBy) => set({ sortBy }),
  setMinScore: (minScore) => set({ minScore }),
  setOrder: (order) => set({ order }),
  reset: () => set({ sortBy: "interest", minScore: 0, order: "score" }),
}));

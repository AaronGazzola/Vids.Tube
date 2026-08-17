"use client";

import { GOAL_METRICS, type GoalMetric } from "@/app/layout.types";
import { riseStep } from "@/lib/rise";
import { useState } from "react";

export type GoalFlight = {
  id: number;
  metric: GoalMetric;
  delta: number;
  total: number;
};

export type GoalTokens = Record<GoalMetric, number>;

// Whether a rise is worth announcing at all.
//
// Subs and likes announce every one: a person subscribing is the event, and it
// only ever happens once each. A viewer count is not a tally of events — it
// wanders up and down all broadcast — so announcing each tick would be constant
// noise. It announces the crossing instead: the moment the count reaches the
// goal, and again if it drops away and comes back.
export function announceRise(
  metric: GoalMetric,
  before: number,
  after: number,
  target: number | null
): boolean {
  if (metric !== "viewers") return true;
  if (!target || target <= 0) return false;
  return after >= target && before < target;
}

type FlightState = {
  // The values these flights were worked out from. Comparing it is what turns a
  // stream of polls into the handful that actually changed something.
  seen: string;
  baselines: Partial<Record<GoalMetric, number | null>>;
  flights: GoalFlight[];
  pulse: GoalTokens;
  nextId: number;
};

const INITIAL: FlightState = {
  seen: "",
  baselines: {},
  flights: [],
  pulse: { subs: 0, likes: 0, viewers: 0 },
  nextId: 1,
};

function key(values: Partial<Record<GoalMetric, number | null>>): string {
  return GOAL_METRICS.map((m) => values[m] ?? "").join("|");
}

// Every announcement in flight, and when each goal should pulse.
//
// The pulse is deliberately not driven by the value changing. It fires when the
// announcement lands, so the goal reacts to something arriving rather than
// twitching on its own several seconds earlier.
//
// A metric whose animation is switched off still has its baseline tracked, so
// turning it back on does not fire a flight for every rise that happened while
// it was off.
//
// The rises are worked out during render rather than in an effect: they are a
// reaction to a value React already has, not to an outside system, and doing it
// in an effect would paint the old number first and set state afterwards.
export function useGoalFlights(
  values: Partial<Record<GoalMetric, number | null>>,
  enabled: Partial<Record<GoalMetric, boolean>>,
  targets: Partial<Record<GoalMetric, number | null>> = {}
) {
  const [state, setState] = useState<FlightState>(INITIAL);
  const seen = key(values);

  if (state.seen !== seen) {
    setState((prev) => {
      if (prev.seen === seen) return prev;
      const baselines = { ...prev.baselines };
      const added: GoalFlight[] = [];
      let nextId = prev.nextId;

      for (const metric of GOAL_METRICS) {
        const value = values[metric] ?? null;
        const before = baselines[metric] ?? null;
        const step = riseStep(before, value);
        baselines[metric] = step.baseline;
        if (!step.rose || enabled[metric] === false) continue;
        if (
          !announceRise(
            metric,
            before as number,
            value as number,
            targets[metric] ?? null
          )
        ) {
          continue;
        }
        added.push({
          id: nextId++,
          metric,
          delta: (value as number) - (before as number),
          total: value as number,
        });
      }

      return {
        ...prev,
        seen,
        baselines,
        nextId,
        flights: added.length ? [...prev.flights, ...added] : prev.flights,
      };
    });
  }

  // The announcement has arrived: retire it and tell its goal to pulse.
  const land = (id: number, metric: GoalMetric) =>
    setState((prev) => ({
      ...prev,
      flights: prev.flights.filter((f) => f.id !== id),
      pulse: { ...prev.pulse, [metric]: prev.pulse[metric] + 1 },
    }));

  // A rise the streamer asked for rather than one the audience caused, so they
  // can see what it looks like without waiting for a subscriber.
  const demo = (metric: GoalMetric, total: number) =>
    setState((prev) => ({
      ...prev,
      nextId: prev.nextId + 1,
      flights: [
        ...prev.flights,
        { id: prev.nextId, metric, delta: 1, total },
      ],
    }));

  return { flights: state.flights, pulse: state.pulse, land, demo };
}

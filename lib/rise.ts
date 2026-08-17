"use client";

import { useEffect, useRef, useState } from "react";

export type RiseStep = { baseline: number | null; rose: boolean };

// The whole rule, as a pure step: given what was last seen and what has just
// arrived, what is the new baseline and was this a rise?
//
// Three cases are deliberately silent. The first value seen is not a rise, it is
// arrival — otherwise every page load, every OBS source refresh and every
// reconnect would celebrate. An unchanged value is not a rise, so a poll that
// reports the same number does nothing. A fall is not a rise, but it does move
// the baseline, so a viewer count that dips and recovers celebrates on the way
// back up rather than staying silent for the rest of the broadcast.
export function riseStep(
  baseline: number | null,
  next: unknown
): RiseStep {
  if (typeof next !== "number" || !Number.isFinite(next)) {
    return { baseline, rose: false };
  }
  if (baseline === null) return { baseline: next, rose: false };
  return { baseline: next, rose: next > baseline };
}

// A token that changes once per rise. Keying an element on it is what restarts
// the animation: a class toggled back on before the previous run finished does
// not restart it, and a rise during the run would otherwise be swallowed.
//
// While disabled the baseline still tracks the value, so nothing is banked up to
// fire the moment it is re-enabled.
export function useRise(
  value: unknown,
  { enabled = true }: { enabled?: boolean } = {}
): number {
  const baseline = useRef<number | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    const step = riseStep(baseline.current, value);
    baseline.current = step.baseline;
    if (step.rose && enabled) setToken((t) => t + 1);
  }, [value, enabled]);

  return token;
}

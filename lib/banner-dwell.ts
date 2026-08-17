import {
  OVERLAY_MESSAGE_DWELL_MAX_MS,
  OVERLAY_MESSAGE_DWELL_MIN_MS,
  OVERLAY_MESSAGE_DWELL_MS,
} from "@/lib/demo-overlay";

function usable(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= OVERLAY_MESSAGE_DWELL_MIN_MS &&
    value <= OVERLAY_MESSAGE_DWELL_MAX_MS
  );
}

// The banner's global display time, made safe to use. A config carrying a value
// the banner cannot honour must not be able to stop it cycling at all, so an
// unusable global falls back to the default rather than being obeyed.
export function resolveGlobalDwell(globalMs: unknown): number {
  return usable(globalMs) ? globalMs : OVERLAY_MESSAGE_DWELL_MS;
}

// How long one message holds. Its own time wins when it has one and that time is
// usable; otherwise the global applies. This is the single place the precedence
// rule is written, and the reason "unset" and "set to the global's number" stay
// different things: only the first reads the global at all.
export function resolveDwell(
  message: { dwellMs?: number } | null | undefined,
  globalMs: unknown
): number {
  const global = resolveGlobalDwell(globalMs);
  const own = message?.dwellMs;
  return usable(own) ? own : global;
}

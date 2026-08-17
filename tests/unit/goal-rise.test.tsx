// @vitest-environment happy-dom
import { GoalBar } from "@/components/overlay/goal-bar";
import type { MetricProgress } from "@/app/layout.types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const progress = (current: number): MetricProgress => ({
  current,
  target: 100,
  total: current,
  goal: 100,
  pct: current,
  reached: false,
});

let root: Root | null = null;
let host: HTMLElement | null = null;

function render(current: number, pulseToken = 0) {
  if (!host) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  }
  act(() => {
    root!.render(
      <GoalBar metric="subs" data={progress(current)} pulseToken={pulseToken} />
    );
  });
}

const pulse = () =>
  Array.from(host!.querySelectorAll("span")).find((el) =>
    (el.getAttribute("style") ?? "").includes("overlay-goal-rise")
  ) ?? null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("a goal overlay pulses when it is told to", () => {
  it("draws nothing on first paint", () => {
    render(40);
    expect(pulse()).toBeNull();
  });

  it("draws nothing when the value changes but no pulse is asked for", () => {
    // The pulse now lands with the announcement rather than firing the moment
    // the number moved, so a bare value change is silent here by design.
    render(40);
    render(41);
    expect(pulse()).toBeNull();
  });

  it("pulses when the token arrives", () => {
    render(40);
    render(41, 1);
    expect(pulse()).not.toBeNull();
  });

  it("restarts on a second pulse rather than swallowing it", () => {
    render(40, 1);
    const first = pulse();
    expect(first).not.toBeNull();
    render(41, 2);
    expect(pulse()).not.toBeNull();
    expect(pulse()).not.toBe(first);
  });

  it("leaves the overlay's own size unchanged while it plays", () => {
    render(40);
    const before = host!.firstElementChild!.getAttribute("style");
    render(41, 1);
    expect(host!.firstElementChild!.getAttribute("style")).toBe(before);
  });
});

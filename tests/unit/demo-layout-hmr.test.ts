// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDemoLayoutMock, saveDemoLayoutMock } = vi.hoisted(() => ({
  getDemoLayoutMock: vi.fn(),
  saveDemoLayoutMock: vi.fn(),
}));

vi.mock("@/app/(app)/live/demo.actions", () => ({
  getDemoLayoutAction: getDemoLayoutMock,
  saveDemoLayoutAction: saveDemoLayoutMock,
  getOverlayUrlInfoAction: vi.fn(),
  regenerateOverlayTokenAction: vi.fn(),
  getDemoFramesAction: vi.fn(),
}));

vi.mock("@/supabase/browser-client", () => ({ supabase: {} }));

import { useDemoLayout } from "@/app/(app)/live/demo.hooks";
import { useDemoLayoutStore } from "@/app/(app)/live/demo.stores";
import {
  DEFAULT_DEMO_LAYOUT,
  mergeDemoLayout,
  type DemoLayoutConfig,
} from "@/app/(app)/live/demo.types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const SAVED_GOAL_SUBS = { x: 123, y: 456, scale: 3.5 };
const SAVED_COMPETITION = { x: 900, y: 111, scale: 0.75 };
const EDITED_GOAL_SUBS = { x: 321, y: 654, scale: 1.25 };

const SAVED: DemoLayoutConfig = mergeDemoLayout({
  ...DEFAULT_DEMO_LAYOUT,
  boxes: {
    ...DEFAULT_DEMO_LAYOUT.boxes,
    goalSubs: SAVED_GOAL_SUBS,
    competition: SAVED_COMPETITION,
  },
});

const DEBOUNCE_WAIT_MS = 900;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function flush(ms = 0) {
  await act(async () => {
    await sleep(ms);
  });
}

async function waitFor(cond: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeout) throw new Error("waitFor timed out");
    await flush(20);
  }
}

function Harness() {
  useDemoLayout(true);
  return null;
}

let root: Root | null = null;

function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => {
    root!.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(Harness)
      )
    );
  });
}

// Mirrors what Fast Refresh does when demo.stores.ts (or an import of it) is
// edited: the store module re-evaluates and create() starts from scratch, so
// subscribers suddenly see the default config and hydrated=false while the
// component instance hosting useDemoLayout keeps its refs.
function simulateHmrStoreRecreation() {
  act(() => {
    useDemoLayoutStore.setState({
      config: DEFAULT_DEMO_LAYOUT,
      hydrated: false,
    });
  });
}

function savedDefaultBoxes(): boolean {
  return saveDemoLayoutMock.mock.calls.some((call) => {
    const config = call[0] as DemoLayoutConfig;
    return (
      JSON.stringify(config.boxes) === JSON.stringify(DEFAULT_DEMO_LAYOUT.boxes)
    );
  });
}

describe("useDemoLayout HMR store recreation", () => {
  beforeEach(() => {
    getDemoLayoutMock.mockReset();
    saveDemoLayoutMock.mockReset();
    getDemoLayoutMock.mockResolvedValue(SAVED);
    saveDemoLayoutMock.mockResolvedValue({ data: { ok: true } });
    useDemoLayoutStore.setState({
      config: DEFAULT_DEMO_LAYOUT,
      hydrated: false,
    });
  });

  afterEach(async () => {
    if (root) {
      const r = root;
      root = null;
      act(() => r.unmount());
    }
    await sleep(0);
    document.body.innerHTML = "";
  });

  it("hydrates the saved layout and never persists it unedited", async () => {
    renderHarness();
    await waitFor(() => useDemoLayoutStore.getState().hydrated);

    const state = useDemoLayoutStore.getState();
    expect(state.config.boxes.goalSubs).toEqual(SAVED_GOAL_SUBS);
    expect(state.config.boxes.competition).toEqual(SAVED_COMPETITION);

    await flush(DEBOUNCE_WAIT_MS);
    expect(saveDemoLayoutMock).not.toHaveBeenCalled();
  });

  it("keeps positions and scale through an HMR store reset and never saves defaults", async () => {
    renderHarness();
    await waitFor(() => useDemoLayoutStore.getState().hydrated);

    act(() => {
      useDemoLayoutStore.getState().setBox("goalSubs", EDITED_GOAL_SUBS);
    });
    await flush(DEBOUNCE_WAIT_MS);
    expect(saveDemoLayoutMock).toHaveBeenCalledTimes(1);
    const savedConfig = saveDemoLayoutMock.mock.calls[0][0] as DemoLayoutConfig;
    expect(savedConfig.boxes.goalSubs).toEqual(EDITED_GOAL_SUBS);

    simulateHmrStoreRecreation();
    await flush(DEBOUNCE_WAIT_MS);

    expect(savedDefaultBoxes()).toBe(false);
    expect(saveDemoLayoutMock).toHaveBeenCalledTimes(1);

    const state = useDemoLayoutStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.config.boxes.goalSubs).toEqual(EDITED_GOAL_SUBS);
    expect(state.config.boxes.competition).toEqual(SAVED_COMPETITION);
  });

  it("does not flush defaults to the DB when unmounted right after an HMR reset", async () => {
    renderHarness();
    await waitFor(() => useDemoLayoutStore.getState().hydrated);

    simulateHmrStoreRecreation();
    const r = root!;
    root = null;
    act(() => r.unmount());
    await flush(DEBOUNCE_WAIT_MS);

    expect(savedDefaultBoxes()).toBe(false);
  });
});

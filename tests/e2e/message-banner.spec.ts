import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  OVERLAY_MESSAGE_DWELL_MS,
  OVERLAY_MESSAGE_TRANSITION_MS,
} from "../../lib/demo-overlay";
import type { Database, Json } from "../../supabase/types";

// A message present in the DOM is not evidence that the strip cycles, and a
// transition described in a stylesheet is not evidence that it runs. The strip
// is judged from what it shows over time, and from geometry sampled at frame
// rate while it is mid-flight.
//
// The owner's saved layout is switched to a known set of messages for the run
// and put back afterwards, which is the pattern the game-window and
// demo-interactivity specs use: the layout row is the only place messages live,
// and the alternative is testing something other than what OBS loads.

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SHORT = "Short one";
const LONG = "A far longer sentence than the first one";
const FORMATTED = "say **bold** *lean* __under__ {#ff0055|hot}";
const MALFORMED = "join **us today";
const MESSAGES = [
  { text: SHORT, align: "left" },
  // Centred, so the alignment is proven on the broadcast rather than in a form.
  { text: LONG, align: "center" },
  { text: FORMATTED, align: "left" },
  { text: MALFORMED, align: "left" },
];

// Read from the overlay's own constants: a change to the dwell must not quietly
// turn this spec into a test of something else.
const DWELL_MS = OVERLAY_MESSAGE_DWELL_MS;
const TRANSITION_MS = OVERLAY_MESSAGE_TRANSITION_MS;

// Several dwells of sampling each, so the default per-test budget is too small.
const LONG_RUN_MS = 90_000;

let ownerSlug: string;
let ownerChannelId: string;
let overlayToken: string | null = null;
let savedLayout: Json | null = null;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data: owner } = await admin
    .from("channels")
    .select("id, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  ownerChannelId = owner!.id;
  ownerSlug = owner!.slug;

  const { data: layout } = await admin
    .from("overlay_layouts")
    .select("config, token")
    .eq("channel_id", ownerChannelId)
    .maybeSingle();
  savedLayout = layout?.config ?? null;
  overlayToken = layout?.token ?? null;

  if (savedLayout) {
    const config = savedLayout as Record<string, unknown>;
    const visible = (config.visible ?? {}) as Record<string, boolean>;
    await admin.from("overlay_layouts").upsert(
      {
        channel_id: ownerChannelId,
        config: {
          ...config,
          visible: { ...visible, members: true },
          messages: MESSAGES,
        } as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" }
    );
  }
});

// A test never costs the owner their positions, their toggles or their words.
test.afterAll(async () => {
  if (savedLayout) {
    await admin.from("overlay_layouts").upsert(
      {
        channel_id: ownerChannelId,
        config: savedLayout,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id" }
    );
  }
});

test.beforeEach(async ({ page }) => {
  test.skip(!overlayToken, "no overlay layout to read");
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`/overlay/${ownerSlug}?token=${overlayToken}`);
  await expect(
    page.locator('[data-testid="message-banner-window"]')
  ).toBeVisible({ timeout: 25_000 });
});

test("the strip shows each message in turn and the order repeats", async ({
  page,
}) => {
  test.setTimeout(LONG_RUN_MS);
  // Sampled from the page rather than read once: what is being proven is that
  // the message changes over time.
  const seen = await page.evaluate(async (dwell) => {
    const order: string[] = [];
    // The message alone, not the count beside it: the count changing is not the
    // strip advancing.
    const read = () =>
      document
        .querySelector(
          '[data-testid="message-banner-showing"] [data-testid="message-banner-text"]'
        )
        ?.textContent?.trim() ?? "";
    const deadline = performance.now() + dwell * 5;
    let last = "";
    while (performance.now() < deadline) {
      const now = read();
      if (now && now !== last) {
        order.push(now);
        last = now;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return order;
  }, DWELL_MS);

  // Five turns of a four-message loop: every message appears, then the first
  // returns, which is the loop rather than a one-way run through the list.
  expect(seen.length).toBeGreaterThanOrEqual(5);
  expect(seen[0]).toContain("Short one");
  expect(seen[1]).toContain("A far longer sentence");
  expect(seen[2]).toContain("bold");
  expect(seen[3]).toContain("join **us today");
  expect(seen[4]).toContain("Short one");
});

test("the outgoing message leaves below the incoming one", async ({ page }) => {
  test.setTimeout(LONG_RUN_MS);
  const caught = await page.evaluate(async (dwell) => {
    const win = document.querySelector('[data-testid="message-banner-window"]')!;
    return await new Promise<{
      showingTop: number;
      leavingTop: number;
      showingText: string;
      leavingText: string;
    } | null>((resolve) => {
      const deadline = performance.now() + dwell * 3;
      const tick = () => {
        const w = win.getBoundingClientRect();
        const showing = document.querySelector(
          '[data-testid="message-banner-showing"]'
        );
        const leaving = document.querySelector(
          '[data-testid="message-banner-leaving"]'
        );
        if (showing && leaving) {
          const s = showing.getBoundingClientRect();
          const l = leaving.getBoundingClientRect();
          // A quarter of the row showing, not a sliver: one pixel of the
          // outgoing message would also be true at the last frame, and would
          // prove the transition had ended rather than that it runs.
          const partly = (r: DOMRect) =>
            Math.min(r.bottom, w.bottom) - Math.max(r.top, w.top) >
            w.height * 0.25;
          // Both rows sit at the same offset for the frame before the animation
          // paints. Separation is what proves the strip is actually in flight.
          const separated = Math.abs(l.top - s.top) > 2;
          if (partly(s) && partly(l) && separated) {
            // Frozen at the caught frame, so the screenshot taken next is the
            // strip mid-flight rather than the strip after it settled.
            for (const el of [showing, leaving]) {
              (el as HTMLElement).style.animationPlayState = "paused";
            }
            resolve({
              showingTop: Math.round(s.top - w.top),
              leavingTop: Math.round(l.top - w.top),
              showingText: showing.textContent ?? "",
              leavingText: leaving.textContent ?? "",
            });
            return;
          }
        }
        if (performance.now() > deadline) {
          resolve(null);
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, DWELL_MS);

  expect(caught, "never caught the strip mid-transition").not.toBeNull();
  // The direction is the point: the message leaving sits below the one arriving.
  expect(caught!.leavingTop).toBeGreaterThan(caught!.showingTop);
  expect(caught!.leavingText).not.toBe(caught!.showingText);

  await page
    .locator('[data-testid="message-banner-window"]')
    .screenshot({ path: "test-results/message-banner-mid-transition.png" });
});

test("the strip keeps its height and its single line across every message", async ({
  page,
}) => {
  test.setTimeout(LONG_RUN_MS);
  const samples = await page.evaluate(
    async ([dwell, transition]) => {
      const strip = () =>
        document.querySelector('[data-testid="message-banner-window"]')!;
      const rows: { height: number; clipped: boolean; text: string }[] = [];
      // One reading per message, taken at rest rather than mid-transition.
      for (let i = 0; i < 4; i += 1) {
        const text = document.querySelector(
          '[data-testid="message-banner-showing"] [data-testid="message-banner-text"]'
        ) as HTMLElement;
        rows.push({
          height: Math.round(strip().getBoundingClientRect().height),
          clipped: text.scrollWidth > text.clientWidth + 1,
          text: text.textContent ?? "",
        });
        await new Promise((r) => setTimeout(r, dwell + transition));
      }
      return rows;
    },
    [DWELL_MS, TRANSITION_MS]
  );

  const heights = new Set(samples.map((s) => s.height));
  expect(heights.size, `heights seen: ${[...heights].join(", ")}`).toBe(1);
  for (const sample of samples) {
    expect(sample.clipped, `clipped: ${sample.text}`).toBe(false);
  }
});

test("a centred message is drawn centred on the broadcast", async ({ page }) => {
  test.setTimeout(LONG_RUN_MS);
  const drawn = await page.evaluate(async (dwell) => {
    const deadline = performance.now() + dwell * 6;
    while (performance.now() < deadline) {
      const row = document.querySelector(
        '[data-testid="message-banner-showing"] [data-testid="message-banner-text"]'
      ) as HTMLElement | null;
      if (row?.textContent?.includes("A far longer sentence")) {
        return getComputedStyle(row).textAlign;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }, DWELL_MS);

  expect(drawn, "the centred message never came round").toBe("center");

  // The message either side of it is left-aligned, so what is being read is the
  // message's own choice rather than a strip-wide setting.
  const neighbour = await page.evaluate(async (dwell) => {
    const deadline = performance.now() + dwell * 6;
    while (performance.now() < deadline) {
      const row = document.querySelector(
        '[data-testid="message-banner-showing"] [data-testid="message-banner-text"]'
      ) as HTMLElement | null;
      if (row?.textContent?.includes("Short one")) {
        return getComputedStyle(row).textAlign;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }, DWELL_MS);

  expect(neighbour).toBe("start");
});

test("formatting reaches the broadcast, and a mistake still shows its words", async ({
  page,
}) => {
  test.setTimeout(LONG_RUN_MS);
  const drawn = await page.evaluate(async (dwell) => {
    const deadline = performance.now() + dwell * 6;
    // Wait for the formatted message to come round.
    while (performance.now() < deadline) {
      const row = document.querySelector(
        '[data-testid="message-banner-showing"] [data-testid="message-banner-text"]'
      );
      if (row?.textContent?.includes("bold")) {
        return [...row.querySelectorAll("span")].map((el) => {
          const s = getComputedStyle(el);
          return {
            text: el.textContent ?? "",
            weight: Number(s.fontWeight),
            italic: s.fontStyle === "italic",
            underline: s.textDecorationLine.includes("underline"),
            color: s.color,
          };
        });
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }, DWELL_MS);

  expect(drawn, "the formatted message never came round").not.toBeNull();
  const runs = drawn!;
  const run = (text: string) => runs.find((r) => r.text === text)!;

  expect(run("bold").weight).toBeGreaterThanOrEqual(700);
  expect(run("lean").italic).toBe(true);
  expect(run("under").underline).toBe(true);
  expect(run("hot").color).toBe("rgb(255, 0, 85)");
  // No message is ever handed to the browser as markup.
  expect(runs.map((r) => r.text).join("")).not.toContain("**");

  const literal = await page.evaluate(async (dwell) => {
    const deadline = performance.now() + dwell * 6;
    while (performance.now() < deadline) {
      const row = document.querySelector('[data-testid="message-banner-showing"]');
      if (row?.textContent?.includes("join")) return row.textContent;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }, DWELL_MS);

  expect(literal, "the malformed message never came round").toContain(
    "join **us today"
  );
});

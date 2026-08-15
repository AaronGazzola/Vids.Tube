import { CHAT_CAPTURE_STALE_MS, isChatCaptureFresh } from "@/lib/worker-status";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-08-15T12:00:00Z");
const agoIso = (ms: number) => new Date(NOW - ms).toISOString();

describe("isChatCaptureFresh", () => {
  it("is fresh just inside the window", () => {
    expect(isChatCaptureFresh(agoIso(CHAT_CAPTURE_STALE_MS - 1), NOW)).toBe(true);
  });

  it("is fresh exactly on the window", () => {
    expect(isChatCaptureFresh(agoIso(CHAT_CAPTURE_STALE_MS), NOW)).toBe(true);
  });

  it("is stale just past the window", () => {
    expect(isChatCaptureFresh(agoIso(CHAT_CAPTURE_STALE_MS + 1), NOW)).toBe(false);
  });

  it("treats never having read as stale, not as unknown", () => {
    expect(isChatCaptureFresh(null, NOW)).toBe(false);
    expect(isChatCaptureFresh(undefined, NOW)).toBe(false);
  });

  it("is stale while the reader sits at its backoff ceiling", () => {
    // The poller backs off to 60s between attempts. Reads failing that long are
    // a stall, and the window is deliberately narrower so it is shown as one.
    expect(isChatCaptureFresh(agoIso(60_000), NOW)).toBe(false);
  });

  it("stays fresh across a normal gap between stamps", () => {
    // A working reader stamps at most every 15s, so two stamps apart is normal.
    expect(isChatCaptureFresh(agoIso(30_000), NOW)).toBe(true);
  });
});

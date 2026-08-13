import { applyReusedSettings, REUSE_EXCLUDED_FIELDS } from "@/lib/settings-reuse";
import type { SettingsForm } from "@/app/(app)/live/settings-tab";
import type { StreamSettings } from "@/app/(app)/live/broadcast.actions";
import { describe, expect, it } from "vitest";

const CURRENT: SettingsForm = {
  title: "tonight",
  description: "current description",
  scheduledLocal: "2026-08-20T19:00",
  youtubeUrl: "https://youtu.be/current",
  goals: { subs: "1", likes: "2", viewers: "3" },
  scoringEnabled: false,
  banMode: "suggest",
  ttsMode: "suggest",
  ttsStability: "0.5",
  ttsSimilarity: "0.75",
  askMode: "suggest",
  bridgeEnabled: false,
  greetReturning: false,
  highlightingEnabled: false,
  usefulInfoEnabled: false,
  competitionStatusEnabled: false,
  progressUpdateEnabled: false,
  wrapupMvpEnabled: false,
  wrapupSummaryEnabled: false,
  wrapupThanksEnabled: false,
  autoDisplayFeatured: false,
  waitingRoomChat: false,
  chatterEnrichment: false,
  disabledCommands: [],
  thumbnailPath: null,
  thumbnailFile: null,
};

// Deliberately different from CURRENT in every field, so a setting that fails
// to copy shows up as a difference rather than passing by coincidence.
const PREVIOUS: StreamSettings = {
  streamId: "previous",
  status: "ended",
  channelSlug: "owner",
  title: "last week",
  description: "previous description",
  scheduledStartAt: "2026-08-01T19:00:00.000Z",
  youtubeVideoId: "previousVideo",
  goals: { subs: 900, likes: 800, viewers: 700 },
  scoringEnabled: true,
  banMode: "auto",
  ttsMode: "auto",
  ttsStability: 0.9,
  ttsSimilarity: 0.1,
  askMode: "auto",
  highlightingEnabled: true,
  autoDisplayFeatured: true,
  waitingRoomChat: true,
  chatterEnrichment: true,
  disabledCommands: ["tts", "ask"],
  usefulInfoEnabled: true,
  competitionStatusEnabled: true,
  progressUpdateEnabled: true,
  wrapupMvpEnabled: true,
  wrapupSummaryEnabled: true,
  wrapupThanksEnabled: true,
  bridgeEnabled: true,
  greetReturning: true,
  workerRunning: false,
  thumbnailPath: "live-thumb/previous.jpg",
};

describe("applyReusedSettings", () => {
  const next = applyReusedSettings(CURRENT, PREVIOUS);

  it("leaves the video URL and the schedule alone", () => {
    expect(next.youtubeUrl).toBe(CURRENT.youtubeUrl);
    expect(next.scheduledLocal).toBe(CURRENT.scheduledLocal);
    expect(REUSE_EXCLUDED_FIELDS).toEqual(["youtubeUrl", "scheduledLocal"]);
  });

  it("copies every other field, so a new setting cannot be forgotten", () => {
    // Driven from the form's own keys rather than a hand-written list: adding a
    // setting without teaching reuse about it fails here.
    const carried = (Object.keys(CURRENT) as (keyof SettingsForm)[]).filter(
      (key) =>
        !REUSE_EXCLUDED_FIELDS.includes(key as never) && key !== "thumbnailFile"
    );

    for (const key of carried) {
      expect(
        JSON.stringify(next[key]),
        `${key} was not copied from the previous broadcast`
      ).not.toBe(JSON.stringify(CURRENT[key]));
    }
  });

  it("takes the thumbnail by reference rather than staging an upload", () => {
    expect(next.thumbnailPath).toBe(PREVIOUS.thumbnailPath);
    expect(next.thumbnailFile).toBeNull();
  });

  it("copies the values themselves, not merely something different", () => {
    expect(next.title).toBe(PREVIOUS.title);
    expect(next.goals).toEqual({ subs: "900", likes: "800", viewers: "700" });
    expect(next.banMode).toBe("auto");
    expect(next.disabledCommands).toEqual(["ask", "tts"]);
  });
});

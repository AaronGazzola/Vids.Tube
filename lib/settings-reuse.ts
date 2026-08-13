import type { StreamSettings } from "@/app/(app)/live/broadcast.actions";
import type { SettingsForm } from "@/app/(app)/live/settings-tab";

// Both identify the broadcast being copied from. A copied video URL would point
// a new broadcast at the old video, and at its chat; a copied schedule would put
// it in the past.
export const REUSE_EXCLUDED_FIELDS = [
  "youtubeUrl",
  "scheduledLocal",
] as const satisfies readonly (keyof SettingsForm)[];

// Pure: takes the form as it stands and a previous broadcast's settings, and
// returns the form as it should be. Nothing is written here, which is what makes
// choosing in the dialog free to undo.
export function applyReusedSettings(
  current: SettingsForm,
  previous: StreamSettings
): SettingsForm {
  return {
    ...current,
    title: previous.title,
    description: previous.description,
    goals: {
      subs: String(previous.goals.subs),
      likes: String(previous.goals.likes),
      viewers: String(previous.goals.viewers),
    },
    scoringEnabled: previous.scoringEnabled,
    banMode: previous.banMode,
    ttsMode: previous.ttsMode,
    ttsStability: String(previous.ttsStability),
    ttsSimilarity: String(previous.ttsSimilarity),
    askMode: previous.askMode,
    highlightingEnabled: previous.highlightingEnabled,
    usefulInfoEnabled: previous.usefulInfoEnabled,
    competitionStatusEnabled: previous.competitionStatusEnabled,
    progressUpdateEnabled: previous.progressUpdateEnabled,
    wrapupMvpEnabled: previous.wrapupMvpEnabled,
    wrapupSummaryEnabled: previous.wrapupSummaryEnabled,
    wrapupThanksEnabled: previous.wrapupThanksEnabled,
    bridgeEnabled: previous.bridgeEnabled,
    greetReturning: previous.greetReturning,
    autoDisplayFeatured: previous.autoDisplayFeatured,
    waitingRoomChat: previous.waitingRoomChat,
    chatterEnrichment: previous.chatterEnrichment,
    disabledCommands: [...previous.disabledCommands].sort(),
    // Shared by reference: the previous broadcast keeps its own thumbnail and
    // nothing is uploaded a second time.
    thumbnailPath: previous.thumbnailPath,
    thumbnailFile: null,
  };
}

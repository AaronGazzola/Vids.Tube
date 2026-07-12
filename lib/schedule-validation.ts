// Pure logic for the schedule-save confirmation. When a Settings save persists a
// scheduled datetime, the /live page checks two things before writing:
//   - readiness: is the local worker reachable and is the YouTube URL set?
//   - first-time public: did this save newly add a datetime (making the broadcast
//     public), and will waiting-room chat be public too?
// It returns the pieces the confirmation dialog needs; an empty `warnings` array
// with `firstTimePublic === false` means no confirmation is required.

export type ScheduleSaveInput = {
  scheduledStartAt: string | null;
  previousScheduledStartAt: string | null;
  workerRunning: boolean;
  hasYoutubeUrl: boolean;
  waitingRoomChat: boolean;
};

export type ScheduleSaveCheck = {
  requiresConfirmation: boolean;
  firstTimePublic: boolean;
  publicChat: boolean;
  warnings: string[];
};

export function evaluateScheduleSave(
  input: ScheduleSaveInput
): ScheduleSaveCheck {
  const isScheduled = input.scheduledStartAt != null;
  const firstTimePublic =
    isScheduled && input.previousScheduledStartAt == null;
  const publicChat = firstTimePublic && input.waitingRoomChat;

  const warnings: string[] = [];
  if (isScheduled) {
    if (!input.workerRunning) {
      warnings.push(
        "The local worker isn't running. Chat scoring, moderation, and YouTube chat won't work until you start it."
      );
    }
    if (!input.hasYoutubeUrl) {
      warnings.push(
        "No YouTube stream URL is set. Likes and viewer goals and YouTube chat won't appear until you add it."
      );
    }
  }

  return {
    requiresConfirmation: firstTimePublic || warnings.length > 0,
    firstTimePublic,
    publicChat,
    warnings,
  };
}

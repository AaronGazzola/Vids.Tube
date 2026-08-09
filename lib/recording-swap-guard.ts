// A broadcast that captured chat live cannot be replaced by deleting it.
//
// `scripts/replace-site-recordings.ts` detaches a broadcast, expects the
// YouTube copy to be imported as a new one, then deletes the original. That was
// right for three broadcasts on 2-Aug-2026 which held no live-captured data. On
// a broadcast that ran with the worker, the same path destroys the chat, the
// scoring, and the memberships, credits and badges that followed from it.

export type BroadcastContents = {
  chatMessages: number;
  transcriptSegments: number;
  membershipStats: number;
};

export function wouldDestroyLiveData(contents: BroadcastContents): boolean {
  return (
    contents.chatMessages > 0 ||
    contents.transcriptSegments > 0 ||
    contents.membershipStats > 0
  );
}

export function refusalMessage(
  day: string,
  contents: BroadcastContents
): string {
  const parts = [
    `${contents.chatMessages} chat messages`,
    `${contents.transcriptSegments} transcript segments`,
    `${contents.membershipStats} membership records`,
  ];
  return [
    `refusing to delete the ${day} broadcast: it holds ${parts.join(", ")}.`,
    "Deleting it would destroy all of that. To replace only the file, use",
    "scripts/swap-recording.ts, which keeps the broadcast and re-anchors its timings.",
  ].join("\n");
}

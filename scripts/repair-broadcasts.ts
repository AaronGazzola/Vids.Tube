// The manual override for the maintenance runner.
//
// The runner (`npm run maintain`) does this on a schedule. This is for running a
// phase by hand: while the runner is being installed, or to force a broadcast
// through a phase it is not yet due.
import {
  catchUpEndedBroadcasts,
  outstandingBroadcasts,
  runPostBroadcastPass,
} from "../worker/lib/post-broadcast";
import type { Phase } from "../lib/post-broadcast-plan";

const argv = process.argv.slice(2);
const flag = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

async function main() {
  const phaseArg = flag("--phase");
  if (phaseArg && phaseArg !== "score" && phaseArg !== "settle") {
    throw new Error("--phase must be score or settle");
  }
  const phase = (phaseArg ?? undefined) as Phase | undefined;

  const streamId = flag("--stream");
  if (streamId) {
    const res = await runPostBroadcastPass(streamId, phase);
    if (!res.ran) {
      console.log("nothing owing for this broadcast; pass --phase to force one");
      return;
    }
    console.log(`${res.phase} phase ${res.clean ? "clean" : "with failures"}`);
    for (const o of res.outcomes) {
      console.log(
        `  ${o.step}: ${o.status}${o.result ? ` ${JSON.stringify(o.result)}` : ""}${
          o.error ? ` — ${o.error}` : ""
        }`
      );
    }
    return;
  }

  const limitRaw = flag("--limit");
  const limit = limitRaw ? Number(limitRaw) : 5;
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  const owed = await outstandingBroadcasts();
  console.log(`${owed.length} broadcast(s) owing work`);
  const { ran, remaining } = await catchUpEndedBroadcasts(limit);
  console.log(ran ? `settled ${ran} broadcast(s)` : "nothing outstanding");
  if (remaining) console.log(`${remaining} left`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

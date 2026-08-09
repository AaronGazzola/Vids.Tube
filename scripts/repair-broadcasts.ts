// Runs the post-broadcast pass by hand, for when a finished broadcast needs
// repairing now rather than on the worker's next idle tick.
//
// The worker repairs finished broadcasts on its own, but only while it has no
// broadcast to engage, and it stops as soon as one appears. That is the right
// default and the wrong one when a broadcast finished badly and the data is
// needed before the next stream.
import { catchUpEndedBroadcasts, runPostBroadcastPass } from "../worker/lib/post-broadcast";

const argv = process.argv.slice(2);
const flag = (f: string) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : null;
};

async function main() {
  const streamId = flag("--stream");
  if (streamId) {
    const res = await runPostBroadcastPass(streamId);
    if (!res.ran) {
      console.log("already repaired; nothing to do");
      return;
    }
    console.log(res.clean ? "repaired clean" : "repaired with failures");
    for (const o of res.outcomes) {
      console.log(`  ${o.step}: ${o.ok ? "ok" : `failed — ${o.error}`}`);
    }
    return;
  }

  const limitRaw = flag("--limit");
  const limit = limitRaw ? Number(limitRaw) : 5;
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("--limit must be a positive number");
  }
  const ran = await catchUpEndedBroadcasts(limit);
  console.log(ran ? `repaired ${ran} broadcast(s)` : "nothing outstanding");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

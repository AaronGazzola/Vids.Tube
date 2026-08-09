// Runs the post-broadcast pass. This is the only thing that runs it: the live
// worker engages broadcasts and nothing else, because repairing rewrites the
// same membership rows a live broadcast writes.
//
// Run it after a broadcast ends. The Settings tab of /live shows how many
// broadcasts are waiting.
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

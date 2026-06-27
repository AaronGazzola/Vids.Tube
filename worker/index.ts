import { workerConfig } from "./config";
import { runScoringJob } from "./jobs/score";
import { runTranscriptionJob } from "./jobs/transcribe";
import {
  releaseLock,
  resolveEligibleStream,
  tryAcquireLock,
} from "./lib/streams";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick(): Promise<void> {
  const stream = await resolveEligibleStream();
  if (!stream) return;

  const locked = await tryAcquireLock(stream.id, workerConfig.loop.lockLeaseMs);
  if (!locked) {
    console.error(`stream ${stream.id} is locked by another worker; skipping`);
    return;
  }

  console.error(`engaging stream ${stream.id} (transcribe + score)`);
  try {
    await Promise.all([runTranscriptionJob(stream), runScoringJob(stream)]);
  } finally {
    await releaseLock(stream.id);
    console.error(`stopped engaging stream ${stream.id}`);
  }
}

async function main(): Promise<void> {
  console.error("worker started; polling for live streams");
  for (;;) {
    try {
      await tick();
    } catch (e) {
      console.error("tick error:", e);
    }
    await sleep(workerConfig.loop.pollMs);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

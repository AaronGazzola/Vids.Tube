import { workerConfig } from "./config";
import { runScoringJob } from "./jobs/score";
import { runTranscriptionJob } from "./jobs/transcribe";
import {
  releaseLock,
  resolveEligibleStream,
  tryAcquireLock,
  upsertWorkerHeartbeat,
} from "./lib/streams";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tick(): Promise<void> {
  await upsertWorkerHeartbeat();

  const stream = await resolveEligibleStream();
  if (!stream) return;

  const locked = await tryAcquireLock(stream.id, workerConfig.loop.lockLeaseMs);
  if (!locked) {
    console.error(`stream ${stream.id} is locked by another worker; skipping`);
    return;
  }

  // Scoring, YouTube-chat polling, and moderation run for any engaged public
  // stream (waiting room or live). Transcription pulls the RTMP feed and only
  // makes sense once the stream is live.
  const jobs = [runScoringJob(stream)];
  if (stream.status === "live") {
    jobs.push(runTranscriptionJob(stream));
  }
  console.error(
    `engaging stream ${stream.id} (${stream.status}): ${
      stream.status === "live" ? "transcribe + score" : "score only"
    }`
  );
  try {
    await Promise.all(jobs);
  } finally {
    await releaseLock(stream.id);
    console.error(`stopped engaging stream ${stream.id}`);
  }
}

async function main(): Promise<void> {
  console.error("worker started; polling for public streams");
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

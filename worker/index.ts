import { workerConfig } from "./config";
import {
  getNightbotToken,
  nightbotConfigured,
  nightbotTokenDaysRemaining,
} from "./lib/nightbot-token";
import { runScoringJob } from "./jobs/score";
import { runTranscriptionJob } from "./jobs/transcribe";
import {
  type EligibleStream,
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
  // makes sense once the stream is live — an engagement that starts in the
  // waiting room must still pick it up when the stream flips to live, and a
  // transcriber that exits mid-broadcast (the RTMP reader periodically hits a
  // clean EOF) must be relaunched, so the scoring loop reports each fresh
  // eligibility snapshot back here.
  const jobs: Promise<void>[] = [];
  let transcription: Promise<void> | null = null;
  const launchTranscription = (fresh: EligibleStream) => {
    const job = runTranscriptionJob(fresh)
      .catch((e) => console.error(`transcription job failed:`, e))
      .finally(() => {
        transcription = null;
      });
    transcription = job;
    jobs.push(job);
  };
  jobs.push(
    runScoringJob(stream, (fresh) => {
      if (fresh.status === "live" && !transcription) {
        console.error(`stream ${stream.id} is live: starting transcription`);
        launchTranscription(fresh);
      }
    })
  );
  if (stream.status === "live") {
    launchTranscription(stream);
  }
  console.error(
    `engaging stream ${stream.id} (${stream.status}): ${
      stream.status === "live" ? "transcribe + score" : "score only"
    }`
  );
  try {
    while (jobs.length) {
      await Promise.all(jobs.splice(0));
    }
  } finally {
    await releaseLock(stream.id);
    console.error(`stopped engaging stream ${stream.id}`);
    // Nothing else happens here. Settling a finished broadcast used to run at
    // this point, ten minutes after the broadcast ended and a day before its
    // chat replay exists, and only when the worker happened to still be alive.
    // It belongs to the maintenance runner now, so stopping this process the
    // moment a broadcast ends loses nothing.
  }
}

async function primeNightbotToken(): Promise<void> {
  if (!nightbotConfigured()) {
    console.error("nightbot not configured — YouTube replies will be skipped");
    return;
  }
  const token = await getNightbotToken();
  const days = nightbotTokenDaysRemaining();
  if (token) {
    console.error(
      `nightbot token ready${days === null ? "" : ` (${days.toFixed(1)} days remaining)`}`
    );
  } else {
    console.error("nightbot token unavailable after refresh attempt");
  }
}

async function main(): Promise<void> {
  console.error("worker started; polling for public streams");
  await primeNightbotToken();
  // This worker only engages live broadcasts. Settling a finished one runs from
  // the maintenance runner (`npm run maintain`), scheduled on an always-on
  // machine, because the chat replay it needs does not exist for a day and this
  // process is stopped the moment a broadcast ends.
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

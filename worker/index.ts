import { workerConfig } from "./config";
import {
  getNightbotToken,
  nightbotConfigured,
  nightbotTokenDaysRemaining,
} from "./lib/nightbot-token";
import { runPostBroadcastPass } from "./lib/post-broadcast";
import { runScoringJob } from "./jobs/score";
import { supabaseAdmin } from "./supabase";
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
    // Engagement ends when the broadcast does, so this is the moment the
    // broadcast can be turned into complete community data.
    try {
      const { data: fresh } = await supabaseAdmin
        .from("streams")
        .select("status")
        .eq("id", stream.id)
        .maybeSingle();
      if (fresh?.status === "ended") {
        await runPostBroadcastPass(stream.id);
      }
    } catch (e) {
      console.error("post-broadcast pass failed:", e);
    }
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
  // This worker only engages live broadcasts. Repairing a finished one is
  // minutes of serial work that writes the same membership rows a live
  // broadcast writes, so it runs as its own command (`npm run repair`).
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

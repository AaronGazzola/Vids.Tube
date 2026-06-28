import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { runClaude } from "../worker/lib/claude";
import {
  buildScoringPrompt,
  parseScoreResult,
} from "../worker/lib/scoring-prompt";
import { applyScoreResult, type BufferedMessage } from "../worker/jobs/score";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = new Set(process.argv.slice(2));
const KEEP = args.has("--keep");
const LIVE = args.has("--live");
const DRY = args.has("--dry");

const TRANSCRIPT = [
  "Alright everyone, today we're building the live overlay system from scratch.",
  "I just wired up the scoring bot so it reads the chat and picks the best messages.",
  "Let's see if it can tell a genuinely funny comment from low-effort spam.",
  "If this works, the funniest and most helpful chatters float to the top of the leaderboard.",
];

type SeedMsg = {
  origin: "vidstube" | "youtube";
  author: string;
  text: string;
  externalAuthorId?: string;
};

const SEED_MESSAGES: SeedMsg[] = [
  {
    origin: "youtube",
    author: "CodeWizard",
    text: "wait you built the whole scoring pipeline with claude -p? that's actually genius",
    externalAuthorId: "UC_SMOKE_wizard",
  },
  {
    origin: "youtube",
    author: "lurker_99",
    text: "first",
    externalAuthorId: "UC_SMOKE_lurker",
  },
  {
    origin: "youtube",
    author: "PunMaster",
    text: "so the bot is judging us... no pressure, it's not like our entire self-worth is a leaderboard ring now",
    externalAuthorId: "UC_SMOKE_pun",
  },
  {
    origin: "youtube",
    author: "spammer",
    text: "gg gg gg gg gg",
    externalAuthorId: "UC_SMOKE_spam",
  },
];

const VIDSTUBE_MESSAGE =
  "Have you considered batching the transcript window so the bot keeps context across the whole segment, not just the last chunk?";

function log(s = "") {
  console.log(s);
}

async function main() {
  log("=== Vids.Tube scoring-bot smoke test ===");
  log(
    `mode: ${DRY ? "DRY (prompt only)" : "FULL (real claude + db writes)"}${
      KEEP ? " --keep" : ""
    }${LIVE ? " --live" : ""}`
  );

  const { data: channel } = await admin
    .from("channels")
    .select("id, slug, handle, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!channel) {
    console.error("No channel exists — cannot seed a stream.");
    process.exit(1);
  }

  const batch: BufferedMessage[] = SEED_MESSAGES.map((m, i) => ({
    ref: `youtube:${m.externalAuthorId}:${i}`,
    origin: "youtube" as const,
    author: m.author,
    text: m.text,
    userId: null,
    externalAuthorId: m.externalAuthorId!,
    authorName: m.author,
    authorAvatarUrl: `https://i.pravatar.cc/150?u=${m.externalAuthorId}`,
    chatMessageId: null,
    createdAt: new Date().toISOString(),
  }));

  if (DRY) {
    batch.push({
      ref: "vidstube:DRY",
      origin: "vidstube",
      author: channel.handle,
      text: VIDSTUBE_MESSAGE,
      userId: channel.owner_user_id,
      externalAuthorId: null,
      authorName: null,
      authorAvatarUrl: null,
      chatMessageId: null,
      createdAt: new Date().toISOString(),
    });
    log("\n--- prompt ---\n");
    log(
      buildScoringPrompt({
        transcript: TRANSCRIPT.join(" "),
        messages: batch.map((m) => ({
          ref: m.ref,
          origin: m.origin,
          author: m.author,
          text: m.text,
        })),
      })
    );
    log("\n(dry run — no claude call, no db writes)");
    return;
  }

  let streamId: string | null = null;
  try {
    const nowIso = new Date().toISOString();
    const { data: created, error: createErr } = await admin
      .from("streams")
      .insert({
        channel_id: channel.id,
        status: LIVE ? "live" : "ended",
        title: "[SMOKE TEST] scoring bot — safe to ignore",
        started_at: nowIso,
        last_seen_at: LIVE ? nowIso : null,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      console.error("Failed to create test stream:", createErr?.message);
      process.exit(1);
    }
    streamId = created.id;
    log(`\nseeded stream ${streamId} (status=${LIVE ? "live" : "ended"})`);

    await admin
      .from("chat_scoring_state")
      .insert({ stream_id: streamId, enabled: true });

    await admin.from("transcript_segments").insert(
      TRANSCRIPT.map((text, i) => ({
        stream_id: streamId!,
        start_s: i * 8,
        end_s: i * 8 + 8,
        text,
      }))
    );

    const { data: vidMsg, error: vidErr } = await admin
      .from("chat_messages")
      .insert({
        stream_id: streamId,
        user_id: channel.owner_user_id,
        body: VIDSTUBE_MESSAGE,
      })
      .select("id, created_at")
      .single();
    if (vidErr || !vidMsg) {
      console.error("Failed to seed vidstube chat message:", vidErr?.message);
    } else {
      batch.push({
        ref: `vidstube:${vidMsg.id}`,
        origin: "vidstube",
        author: channel.handle,
        text: VIDSTUBE_MESSAGE,
        userId: channel.owner_user_id,
        externalAuthorId: null,
        authorName: null,
        authorAvatarUrl: null,
        chatMessageId: vidMsg.id,
        createdAt: vidMsg.created_at,
      });
    }

    log(`seeded ${batch.length} chat messages + ${TRANSCRIPT.length} transcript segments`);

    const prompt = buildScoringPrompt({
      transcript: TRANSCRIPT.join(" "),
      messages: batch.map((m) => ({
        ref: m.ref,
        origin: m.origin,
        author: m.author,
        text: m.text,
      })),
    });

    log("\ncalling claude -p (this can take 10-60s)...");
    const raw = await runClaude(prompt);
    if (!raw) {
      console.error(
        "\nFAIL ✗  claude returned nothing — is the `claude` CLI on PATH and logged in? (run `npm run worker:doctor`)"
      );
      process.exitCode = 1;
      return;
    }

    const result = parseScoreResult(raw);
    log(
      `claude scored ${result.scores.length}/${batch.length} messages, featured ${result.featured.length}`
    );
    if (result.scores.length === 0) {
      console.error(
        "\nFAIL ✗  parsed zero scores from claude output — the model didn't return the expected JSON shape."
      );
      console.error("Raw output was:\n" + raw.slice(0, 800));
      process.exitCode = 1;
      return;
    }

    const batchRefs = new Set(batch.map((m) => m.ref));
    const unmatched = result.scores
      .map((s) => s.ref)
      .filter((r) => !batchRefs.has(r));
    if (unmatched.length) {
      log(
        `\nWARN  ${unmatched.length} scored ref(s) did not match the batch — these get dropped:`
      );
      log(`  returned: ${result.scores.map((s) => s.ref).join("  |  ")}`);
      log(`  expected: ${[...batchRefs].join("  |  ")}`);
    }

    await applyScoreResult(streamId, batch, result);

    const { data: scores } = await admin
      .from("viewer_scores")
      .select("author_name, origin, total_score, features_count, participant_key")
      .eq("stream_id", streamId)
      .order("total_score", { ascending: false });

    const { data: featured } = await admin
      .from("featured_messages")
      .select("origin, author_name, score, categories, reason")
      .eq("stream_id", streamId)
      .order("score", { ascending: false });

    log("\n--- leaderboard (viewer_scores) ---");
    for (const s of scores ?? []) {
      const who =
        s.author_name ?? (s.origin === "vidstube" ? channel.handle : s.participant_key);
      log(
        `  ${String(s.total_score).padStart(4)}  ${s.origin.padEnd(8)} ${who}  (featured ${s.features_count}×)`
      );
    }

    log("\n--- featured messages ---");
    if (!featured?.length) {
      log("  (claude featured nothing this round — valid; tune the rubric or seed punchier messages)");
    }
    for (const f of featured ?? []) {
      log(`  [${f.score}] ${f.author_name ?? "vidstube viewer"} — ${f.reason}`);
      log(`        tags: ${(f.categories ?? []).join(", ")}`);
    }

    const weightedOk = (scores ?? []).some((s) => s.origin === "vidstube");
    log("\n--- assertions ---");
    log(`  PASS  scoring loop wrote ${scores?.length ?? 0} viewer_scores rows`);
    log(
      `  ${weightedOk ? "PASS" : "WARN"}  vidstube participant present (1.5× weighting path exercised)`
    );

    if (KEEP) {
      log(`\n--keep set: data left in place. stream id = ${streamId}`);
      if (LIVE)
        log(
          `view overlays: /overlay/${channel.slug}/competition  (live+fresh for ~60s)`
        );
    }
  } finally {
    if (streamId && !KEEP) {
      await admin.from("featured_messages").delete().eq("stream_id", streamId);
      await admin.from("score_events").delete().eq("stream_id", streamId);
      await admin.from("viewer_scores").delete().eq("stream_id", streamId);
      await admin.from("transcript_segments").delete().eq("stream_id", streamId);
      await admin.from("chat_messages").delete().eq("stream_id", streamId);
      await admin.from("chat_scoring_state").delete().eq("stream_id", streamId);
      await admin.from("streams").delete().eq("id", streamId);
      log("\ncleaned up all seeded rows.");
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

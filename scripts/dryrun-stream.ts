import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/types";
import { fetchSubs, fetchVideoData, parseVideoId } from "../lib/youtube";
import { runClaude } from "../worker/lib/claude";
import {
  buildScoringPrompt,
  parseScoreResult,
} from "../worker/lib/scoring-prompt";
import {
  applyModeration,
  applyScoreResult,
  type BufferedMessage,
} from "../worker/jobs/score";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vids.tube";

const admin = createClient<Database>(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const KEEP = args.includes("--keep");
const QUIET = args.includes("--quiet");
const ytArg = args[args.indexOf("--youtube") + 1];
const YT = args.includes("--youtube") ? parseVideoId(ytArg ?? "") : null;
const ticksArg = args[args.indexOf("--ticks") + 1];
const MAX_TICKS = args.includes("--ticks") ? Number(ticksArg) : Infinity;

const TRANSCRIPT = [
  "Welcome in everyone, today we're putting the whole overlay stack through its paces.",
  "The bot reads the chat and ranks who's bringing the best energy.",
  "Drop your hottest takes and let's see who climbs the leaderboard.",
];

const NORMAL: { author: string; text: string; ext: string }[] = [
  { author: "CodeWizard", text: "this overlay setup is genuinely slick, nice work", ext: "UC_DRY_wizard" },
  { author: "PunMaster", text: "the avatars racing each other is unreasonably fun to watch", ext: "UC_DRY_pun" },
  { author: "sunny_dev", text: "wait how is the leaderboard scoring decided?", ext: "UC_DRY_sunny" },
  { author: "hypebeast", text: "LETS GOOO this stream is on fire 🔥", ext: "UC_DRY_hype" },
  { author: "quiet_one", text: "first time catching you live, loving it", ext: "UC_DRY_quiet" },
  { author: "skeptic", text: "does the bot actually understand sarcasm though", ext: "UC_DRY_skeptic" },
  { author: "builder", text: "could you show the OBS source layout at some point?", ext: "UC_DRY_builder" },
];

const ABUSIVE: { author: string; text: string; ext: string }[] = [
  { author: "spambot", text: "BUY CHEAP FOLLOWERS NOW at sketchy-link dot example spam spam spam", ext: "UC_DRY_spam" },
  { author: "troll", text: "you're garbage at this and everyone watching is an idiot", ext: "UC_DRY_troll" },
];

function pick<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(Math.random() * arr.length)]);
  return out;
}

function log(s = "") {
  console.log(s);
}

let stop = false;
let streamId: string | null = null;
let channelId: string | null = null;

async function cleanup() {
  if (!streamId || KEEP) {
    if (KEEP && streamId) log(`\n--keep: stream ${streamId} left live. Remember to clean it up.`);
    return;
  }
  if (channelId) {
    await admin
      .from("banned_participants")
      .delete()
      .eq("channel_id", channelId)
      .like("participant_key", "youtube:UC_DRY_%");
  }
  await admin.from("streams").delete().eq("id", streamId);
  log("\ncleaned up the dry-run stream and all its data.");
}

async function main() {
  log("=== Vids.Tube dry-run stream ===");
  const { data: channel } = await admin
    .from("channels")
    .select("id, slug, handle, owner_user_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!channel) {
    console.error("No channel exists.");
    process.exit(1);
  }
  channelId = channel.id;

  const nowIso = new Date().toISOString();
  const { data: created } = await admin
    .from("streams")
    .insert({
      channel_id: channel.id,
      status: "live",
      title: "[DRY RUN] overlay + bot test",
      started_at: nowIso,
      last_seen_at: nowIso,
      youtube_video_id: YT,
    })
    .select("id")
    .single();
  streamId = created!.id;

  await admin
    .from("chat_scoring_state")
    .insert({ stream_id: streamId, enabled: true, moderation_mode: "manual" });

  await admin.from("transcript_segments").insert(
    TRANSCRIPT.map((text, i) => ({
      stream_id: streamId!,
      start_s: i * 6,
      end_s: i * 6 + 6,
      text,
    }))
  );

  if (YT) {
    try {
      const video = await fetchVideoData(YT);
      const subs = await fetchSubs(video.channelId);
      await admin
        .from("streams")
        .update({ youtube_channel_id: video.channelId })
        .eq("id", streamId);
      await admin.from("stream_goals").upsert(
        {
          stream_id: streamId,
          subs_goal: subs + 50,
          likes_goal: video.likeCount + 100,
          viewers_goal: Math.max(50, video.concurrentViewers + 25),
          baseline_subs: subs,
          baseline_likes: video.likeCount,
          baseline_viewers: video.concurrentViewers,
          started_at: new Date().toISOString(),
        },
        { onConflict: "stream_id" }
      );
      log(`goals wired to YouTube ${YT} (subs ${subs}, likes ${video.likeCount})`);
    } catch (e) {
      console.error("YouTube goals setup failed (continuing without goals):", e);
    }
  }

  log(`\nstream ${streamId} is LIVE. Mode: manual (flip to auto in the Control Room).`);
  log("Open these (signed in as the owner):");
  log(`  Control room:  ${site}/studio/control`);
  log(`  Channel/chat:  ${site}/${channel.slug}`);
  log(`  Highlight:     ${site}/overlay/${channel.slug}`);
  log(`  Goals:         ${site}/overlay/${channel.slug}/goals${YT ? "" : "  (set --youtube to populate)"}`);
  log(`  Competition:   ${site}/overlay/${channel.slug}/competition`);
  log(`\nType in the live chat and watch it score. Ctrl+C to stop + clean up.\n`);

  let cursor = nowIso;
  let tick = 0;

  while (!stop && tick < MAX_TICKS) {
    tick++;
    await admin
      .from("streams")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", streamId);

    const { data: newChat } = await admin
      .from("chat_messages")
      .select("id, user_id, body, created_at")
      .eq("stream_id", streamId)
      .eq("origin", "vidstube")
      .is("hidden_at", null)
      .gt("created_at", cursor)
      .order("created_at", { ascending: true })
      .limit(50);
    if (newChat?.length) cursor = newChat[newChat.length - 1].created_at;

    const vid: BufferedMessage[] = (newChat ?? []).map((m) => ({
      ref: `vidstube:${m.id}`,
      origin: "vidstube" as const,
      author: channel.handle,
      text: m.body,
      userId: m.user_id,
      externalAuthorId: null,
      authorName: null,
      authorAvatarUrl: null,
      chatMessageId: m.id,
      createdAt: m.created_at,
    }));

    const synth: BufferedMessage[] = [];
    if (!QUIET) {
      const batchPool = [...pick(NORMAL, 1 + Math.floor(Math.random() * 2))];
      if (tick % 4 === 0) batchPool.push(pick(ABUSIVE, 1)[0]);
      for (let i = 0; i < batchPool.length; i++) {
        const s = batchPool[i];
        const avatar = `https://i.pravatar.cc/150?u=${s.ext}`;
        const { data: row } = await admin
          .from("chat_messages")
          .insert({
            stream_id: streamId!,
            origin: "youtube",
            external_author_id: s.ext,
            author_name: s.author,
            author_avatar_url: avatar,
            external_message_id: `${s.ext}:${tick}-${i}`,
            body: s.text,
          })
          .select("id")
          .maybeSingle();
        synth.push({
          ref: `youtube:${s.ext}:${tick}-${i}`,
          origin: "youtube",
          author: s.author,
          text: s.text,
          userId: null,
          externalAuthorId: s.ext,
          authorName: s.author,
          authorAvatarUrl: avatar,
          chatMessageId: row?.id ?? null,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const batch = [...vid, ...synth];
    if (batch.length) {
      const prompt = buildScoringPrompt({
        transcript: TRANSCRIPT.join(" "),
        messages: batch.map((m) => ({
          ref: m.ref,
          origin: m.origin,
          author: m.author,
          text: m.text,
        })),
      });
      let raw = "";
      try {
        raw = await runClaude(prompt);
      } catch (e) {
        console.error("claude failed this tick:", e);
      }
      if (raw) {
        const result = parseScoreResult(raw);
        await applyScoreResult(streamId, batch, result);
        const { data: state } = await admin
          .from("chat_scoring_state")
          .select("moderation_mode")
          .eq("stream_id", streamId)
          .maybeSingle();
        const mode = state?.moderation_mode === "auto" ? "auto" : "manual";
        await applyModeration(streamId, channelId, batch, result.moderation, mode);
        log(
          `tick ${tick}: scored ${result.scores.length} (${vid.length} chat + ${synth.length} sim), featured ${result.featured.length}, moderation ${result.moderation.length} [${mode}]`
        );
      }
    } else {
      log(`tick ${tick}: no new messages`);
    }

    if (tick >= MAX_TICKS) break;
    await new Promise((r) => setTimeout(r, 8000));
  }

  await cleanup();
}

process.on("SIGINT", async () => {
  log("\nstopping…");
  stop = true;
  await cleanup();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await cleanup();
  process.exit(1);
});

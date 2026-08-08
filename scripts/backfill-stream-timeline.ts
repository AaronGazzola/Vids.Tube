import { createClient } from "@supabase/supabase-js";
import { messageVideoMs, normalizeGaps } from "../lib/chat-replay";
import { chatActivitySeries } from "../lib/timeline-activity";
import {
  PROMPT_VERSION,
  mergeTimelinePayloads,
  snapSpanBoundaries,
  validateTimelinePayload,
} from "../lib/timeline";
import type {
  ActivityBucket,
  ChatLine,
  TimelinePayload,
  TranscriptLine,
} from "../lib/timeline.types";
import type { Database } from "../supabase/types";
import { extractJson, runClaude } from "../worker/lib/claude";
import { buildTimelinePrompt } from "../worker/lib/timeline-prompt";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const ONLY_STREAM = flag("--stream");
const LIMIT = flag("--limit") ? Number(flag("--limit")) : Infinity;
const FORCE = argv.includes("--force");
const DRY_RUN = argv.includes("--dry-run");

const PAGE = 1000;
const SNAP_TOLERANCE_S = 5;
const MAX_PROMPT_CHARS = 1_400_000;
const SEAM_OVERLAP_S = 120;

type Candidate = {
  streamId: string;
  title: string;
  startedAt: string | null;
  liveAt: string | null;
  youtubeVideoId: string | null;
  durationS: number;
};

async function assertTablesExist() {
  for (const table of [
    "stream_threads",
    "stream_thread_spans",
    "stream_moments",
    "stream_chapters",
  ] as const) {
    const { error } = await admin.from(table).select("id").limit(1);
    if (error) {
      throw new Error(
        `${table} is not available (${error.message}). Run the timeline_threads migration first: npx supabase db push`
      );
    }
  }
}

// Labelled means labelled by THIS prompt. A prompt change therefore makes the whole
// catalogue a candidate again without --force, so a relabel cannot half-apply and
// leave two prompt versions mixed together.
async function labelledStreamIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const table of ["stream_threads", "stream_moments", "stream_chapters"] as const) {
    let from = 0;
    while (true) {
      const { data, error } = await admin
        .from(table)
        .select("stream_id")
        .eq("prompt_version", PROMPT_VERSION)
        .range(from, from + PAGE - 1);
      if (error) {
        throw new Error(`Failed to read ${table}: ${error.message}`);
      }
      for (const row of data ?? []) {
        ids.add(row.stream_id);
      }
      if (!data || data.length < PAGE) {
        break;
      }
      from += PAGE;
    }
  }
  return ids;
}

async function selectStreams(): Promise<Candidate[]> {
  const { data: videos, error: videoError } = await admin
    .from("videos")
    .select("source_stream_id, duration_s, status, mp4_path")
    .eq("status", "ready")
    .not("source_stream_id", "is", null)
    .not("mp4_path", "is", null);
  if (videoError) {
    throw new Error(`Failed to list videos: ${videoError.message}`);
  }

  const durationByStream = new Map<string, number>();
  for (const video of videos ?? []) {
    if (!video.source_stream_id || !video.duration_s) {
      continue;
    }
    const existing = durationByStream.get(video.source_stream_id) ?? 0;
    durationByStream.set(
      video.source_stream_id,
      Math.max(existing, video.duration_s)
    );
  }

  let query = admin
    .from("streams")
    .select("id, title, started_at, live_at, youtube_video_id")
    .order("started_at", { ascending: false });
  if (ONLY_STREAM) {
    query = query.eq("id", ONLY_STREAM);
  }
  const { data: streams, error: streamError } = await query;
  if (streamError) {
    throw new Error(`Failed to list streams: ${streamError.message}`);
  }

  const labelled = FORCE ? new Set<string>() : await labelledStreamIds();
  const out: Candidate[] = [];

  for (const stream of streams ?? []) {
    if (out.length >= LIMIT) {
      break;
    }
    const durationS = durationByStream.get(stream.id);
    if (!durationS) {
      if (ONLY_STREAM) {
        console.error(
          `Stream ${stream.id} has no ready VOD with a duration; nothing to label against.`
        );
      }
      continue;
    }
    if (labelled.has(stream.id)) {
      continue;
    }
    out.push({
      streamId: stream.id,
      title: stream.title ?? "(untitled stream)",
      startedAt: stream.started_at,
      liveAt: stream.live_at,
      youtubeVideoId: stream.youtube_video_id,
      durationS,
    });
  }

  return out;
}

async function loadTranscript(
  candidate: Candidate
): Promise<{ source: "live" | "captions"; lines: TranscriptLine[] } | null> {
  const live: TranscriptLine[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("transcript_segments")
      .select("start_s, end_s, text")
      .eq("stream_id", candidate.streamId)
      .order("start_s", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(`Failed to read transcript_segments: ${error.message}`);
    }
    for (const row of data ?? []) {
      live.push({ atS: row.start_s, endS: row.end_s, text: row.text });
    }
    if (!data || data.length < PAGE) {
      break;
    }
    from += PAGE;
  }
  if (live.length > 0) {
    return { source: "live", lines: live };
  }

  if (!candidate.youtubeVideoId) {
    return null;
  }

  const captions: TranscriptLine[] = [];
  from = 0;
  while (true) {
    const { data, error } = await admin
      .from("youtube_transcripts")
      .select("start_s, end_s, text")
      .eq("video_id", candidate.youtubeVideoId)
      .order("start_s", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(`Failed to read youtube_transcripts: ${error.message}`);
    }
    for (const row of data ?? []) {
      captions.push({ atS: row.start_s, endS: row.end_s, text: row.text });
    }
    if (!data || data.length < PAGE) {
      break;
    }
    from += PAGE;
  }

  return captions.length > 0 ? { source: "captions", lines: captions } : null;
}

async function loadChat(candidate: Candidate): Promise<ChatLine[]> {
  const baseIso = candidate.liveAt ?? candidate.startedAt;
  if (!baseIso) {
    return [];
  }
  const baseMs = new Date(baseIso).getTime();
  if (!Number.isFinite(baseMs)) {
    return [];
  }

  const { data: gapRows, error: gapError } = await admin
    .from("stream_gaps")
    .select("gap_start_at, gap_end_at")
    .eq("stream_id", candidate.streamId)
    .order("gap_start_at", { ascending: true });
  if (gapError) {
    throw new Error(`Failed to read stream_gaps: ${gapError.message}`);
  }
  const gaps = normalizeGaps(
    (gapRows ?? []).map((gap) => ({
      startAt: gap.gap_start_at,
      endAt: gap.gap_end_at,
    })),
    baseMs
  );

  const lines: ChatLine[] = [];

  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("chat_messages")
      .select("created_at, author_name, body")
      .eq("stream_id", candidate.streamId)
      .is("hidden_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(`Failed to read chat_messages: ${error.message}`);
    }
    for (const row of data ?? []) {
      lines.push({
        atS: messageVideoMs(new Date(row.created_at).getTime(), baseMs, gaps) / 1000,
        author: row.author_name ?? "viewer",
        body: row.body,
      });
    }
    if (!data || data.length < PAGE) {
      break;
    }
    from += PAGE;
  }

  if (candidate.youtubeVideoId) {
    from = 0;
    while (true) {
      const { data, error } = await admin
        .from("youtube_chat_archive")
        .select("published_at, author_name, body")
        .eq("video_id", candidate.youtubeVideoId)
        .order("published_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        throw new Error(`Failed to read youtube_chat_archive: ${error.message}`);
      }
      for (const row of data ?? []) {
        lines.push({
          atS:
            messageVideoMs(new Date(row.published_at).getTime(), baseMs, gaps) /
            1000,
          author: row.author_name ?? "viewer",
          body: row.body,
        });
      }
      if (!data || data.length < PAGE) {
        break;
      }
      from += PAGE;
    }
  }

  return lines.sort((a, b) => a.atS - b.atS);
}

type StreamInputs = {
  candidate: Candidate;
  source: "live" | "captions";
  transcript: TranscriptLine[];
  chat: ChatLine[];
  activity: ActivityBucket[];
  boundaries: number[];
};

async function loadStreamInputs(
  candidate: Candidate
): Promise<StreamInputs | null> {
  const transcript = await loadTranscript(candidate);
  if (!transcript) {
    return null;
  }
  const chat = await loadChat(candidate);
  const boundaries = [
    ...new Set(transcript.lines.flatMap((line) => [line.atS, line.endS])),
  ].sort((a, b) => a - b);
  return {
    candidate,
    source: transcript.source,
    transcript: transcript.lines,
    chat,
    activity: chatActivitySeries(chat),
    boundaries,
  };
}

function sliceInputs(
  inputs: StreamInputs,
  fromS: number,
  toS: number
): StreamInputs {
  return {
    ...inputs,
    transcript: inputs.transcript.filter(
      (line) => line.atS >= fromS && line.atS <= toS
    ),
    chat: inputs.chat.filter((line) => line.atS >= fromS && line.atS <= toS),
    activity: inputs.activity.filter(
      (bucket) => bucket.atS >= fromS && bucket.atS <= toS
    ),
  };
}

async function runPass(
  inputs: StreamInputs
): Promise<TimelinePayload | { error: string }> {
  const prompt = buildTimelinePrompt({
    title: inputs.candidate.title,
    durationS: inputs.candidate.durationS,
    transcript: inputs.transcript,
    chatLines: inputs.chat,
    activity: inputs.activity,
  });

  let raw: string;
  try {
    raw = await runClaude(prompt);
  } catch (error) {
    return { error: `claude -p failed: ${(error as Error).message}` };
  }

  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch (error) {
    return { error: `could not parse a JSON object: ${(error as Error).message}` };
  }

  return validateTimelinePayload(parsed, inputs.candidate.durationS);
}

async function labelStream(
  inputs: StreamInputs
): Promise<TimelinePayload | { error: string }> {
  const wholePrompt = buildTimelinePrompt({
    title: inputs.candidate.title,
    durationS: inputs.candidate.durationS,
    transcript: inputs.transcript,
    chatLines: inputs.chat,
    activity: inputs.activity,
  });

  let payload: TimelinePayload;

  if (wholePrompt.length <= MAX_PROMPT_CHARS) {
    const result = await runPass(inputs);
    if ("error" in result) {
      return result;
    }
    payload = result;
  } else {
    const midpoint = inputs.candidate.durationS / 2;
    const first = await runPass(
      sliceInputs(inputs, 0, midpoint + SEAM_OVERLAP_S)
    );
    if ("error" in first) {
      return first;
    }
    const second = await runPass(
      sliceInputs(
        inputs,
        Math.max(0, midpoint - SEAM_OVERLAP_S),
        inputs.candidate.durationS
      )
    );
    if ("error" in second) {
      return second;
    }
    payload = mergeTimelinePayloads([first, second], SEAM_OVERLAP_S);
  }

  return snapSpanBoundaries(payload, inputs.boundaries, SNAP_TOLERANCE_S);
}

async function writeTimeline(streamId: string, payload: TimelinePayload) {
  if (DRY_RUN) {
    return;
  }

  // Moments before threads: a moment references a thread, and clearing the threads
  // first would null those references on rows about to be deleted anyway.
  for (const table of [
    "stream_moments",
    "stream_thread_spans",
    "stream_threads",
    "stream_chapters",
  ] as const) {
    const { error } = await admin.from(table).delete().eq("stream_id", streamId);
    if (error) {
      throw new Error(`Failed to clear ${table}: ${error.message}`);
    }
  }

  const threadIdByTitle = new Map<string, string>();
  if (payload.threads.length > 0) {
    const { data, error } = await admin
      .from("stream_threads")
      .insert(
        payload.threads.map((thread) => ({
          stream_id: streamId,
          title: thread.title,
          summary: thread.summary,
          tags: thread.tags,
          scores: thread.scores,
          prompt_version: PROMPT_VERSION,
        }))
      )
      .select("id, title");
    if (error) {
      throw new Error(`Failed to insert threads: ${error.message}`);
    }
    for (const row of data ?? []) {
      threadIdByTitle.set(row.title.trim().toLowerCase(), row.id);
    }

    const spans = payload.threads.flatMap((thread) => {
      const threadId = threadIdByTitle.get(thread.title.trim().toLowerCase());
      if (!threadId) {
        return [];
      }
      return thread.spans.map((span, ordinal) => ({
        thread_id: threadId,
        stream_id: streamId,
        start_s: span.start_s,
        end_s: span.end_s,
        label: span.label,
        ordinal,
        scores: span.scores,
      }));
    });
    if (spans.length > 0) {
      const { error: spanError } = await admin
        .from("stream_thread_spans")
        .insert(spans);
      if (spanError) {
        throw new Error(`Failed to insert spans: ${spanError.message}`);
      }
    }
  }

  if (payload.moments.length > 0) {
    const { error } = await admin.from("stream_moments").insert(
      payload.moments.map((moment) => ({
        stream_id: streamId,
        thread_id: moment.thread
          ? threadIdByTitle.get(moment.thread.trim().toLowerCase()) ?? null
          : null,
        start_s: moment.start_s,
        peak_s: moment.peak_s,
        end_s: moment.end_s,
        kind: moment.kind,
        label: moment.label,
        summary: moment.summary,
        tags: moment.tags,
        scores: moment.scores,
        prompt_version: PROMPT_VERSION,
      }))
    );
    if (error) {
      throw new Error(`Failed to insert moments: ${error.message}`);
    }
  }

  if (payload.chapters.length > 0) {
    const { error } = await admin.from("stream_chapters").insert(
      payload.chapters.map((chapter) => ({
        stream_id: streamId,
        start_s: chapter.start_s,
        title: chapter.title,
        prompt_version: PROMPT_VERSION,
      }))
    );
    if (error) {
      throw new Error(`Failed to insert chapters: ${error.message}`);
    }
  }
}

async function main() {
  await assertTablesExist();

  const candidates = await selectStreams();
  if (candidates.length === 0) {
    console.log("No streams to label.");
    return;
  }

  console.log(
    `${candidates.length} stream(s) to label${DRY_RUN ? " (dry run)" : ""}${FORCE ? " (force)" : ""}.`
  );

  let labelled = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const startedAt = Date.now();
    const date = candidate.startedAt?.slice(0, 10) ?? "unknown-date";
    try {
      const inputs = await loadStreamInputs(candidate);
      if (!inputs) {
        skipped += 1;
        console.log(
          `SKIP  ${date} ${candidate.streamId} no transcript available`
        );
        continue;
      }

      const result = await labelStream(inputs);
      if ("error" in result) {
        failed += 1;
        console.error(`FAIL  ${date} ${candidate.streamId} ${result.error}`);
        continue;
      }

      await writeTimeline(candidate.streamId, result);
      labelled += 1;
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const spans = result.threads.reduce((n, t) => n + t.spans.length, 0);
      const recurring = result.threads.filter((t) => t.spans.length > 1).length;
      console.log(
        `OK    ${date} ${candidate.streamId} source=${inputs.source} threads=${result.threads.length} (${recurring} recurring) spans=${spans} moments=${result.moments.length} chapters=${result.chapters.length} ${elapsed}s`
      );
    } catch (error) {
      failed += 1;
      console.error(
        `FAIL  ${date} ${candidate.streamId} ${(error as Error).message}`
      );
    }
  }

  console.log(`labelled=${labelled} skipped=${skipped} failed=${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

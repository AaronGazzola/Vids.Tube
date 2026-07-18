import { createClient } from "@supabase/supabase-js";
import { execFile } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { parseVideoId } from "../lib/youtube";
import type { Database } from "../supabase/types";

const execFileAsync = promisify(execFile);

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const YTDLP = process.env.YTDLP_BIN ?? "yt-dlp";
const FORCE = process.argv.includes("--force");
const URL_FILE = join(process.cwd(), "data", "youtube-vod-urls.txt");
const BATCH = 500;

type ArchiveRow = {
  video_id: string;
  message_id: string;
  author_channel_id: string;
  author_name: string | null;
  body: string;
  published_at: string;
};

async function ytdlp(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(YTDLP, args, {
    maxBuffer: 1024 * 1024 * 64,
  });
  return stdout;
}

async function resolveChannelId(): Promise<string | null> {
  const { data } = await admin
    .from("streams")
    .select("youtube_channel_id")
    .not("youtube_channel_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.youtube_channel_id ?? null;
}

async function publicUploadIds(channelId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const tab of ["videos", "streams"]) {
    try {
      const out = await ytdlp([
        "--flat-playlist",
        "--print",
        "id",
        `https://www.youtube.com/channel/${channelId}/${tab}`,
      ]);
      ids.push(...out.split(/\r?\n/).filter(Boolean));
    } catch (e) {
      console.error(`listing ${tab} tab failed:`, (e as Error).message);
    }
  }
  return ids;
}

async function dbVideoIds(): Promise<string[]> {
  const { data } = await admin
    .from("streams")
    .select("youtube_video_id")
    .not("youtube_video_id", "is", null);
  return [...new Set((data ?? []).map((r) => r.youtube_video_id!))];
}

function fileVideoIds(): string[] {
  if (!existsSync(URL_FILE)) {
    return [];
  }
  const ids: string[] = [];
  for (const line of readFileSync(URL_FILE, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const id = parseVideoId(trimmed);
    if (id) {
      ids.push(id);
    } else {
      console.error(`unparseable line in ${URL_FILE}: ${trimmed}`);
    }
  }
  return ids;
}

type ChatRenderer = {
  id?: string;
  timestampUsec?: string;
  authorExternalChannelId?: string;
  authorName?: { simpleText?: string };
  message?: {
    runs?: { text?: string; emoji?: { emojiId?: string; shortcuts?: string[] } }[];
  };
};

function rendererToRow(videoId: string, r: ChatRenderer): ArchiveRow | null {
  if (!r.id || !r.timestampUsec || !r.authorExternalChannelId) {
    return null;
  }
  const body = (r.message?.runs ?? [])
    .map((run) => run.text ?? run.emoji?.shortcuts?.[0] ?? run.emoji?.emojiId ?? "")
    .join("");
  if (!body) {
    return null;
  }
  return {
    video_id: videoId,
    message_id: r.id,
    author_channel_id: r.authorExternalChannelId,
    author_name: r.authorName?.simpleText ?? null,
    body,
    published_at: new Date(Number(r.timestampUsec) / 1000).toISOString(),
  };
}

function parseLiveChatFile(videoId: string, path: string): ArchiveRow[] {
  const rows: ArchiveRow[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const actions =
      (obj as { replayChatItemAction?: { actions?: unknown[] } })
        .replayChatItemAction?.actions ?? [];
    for (const action of actions) {
      const renderer = (
        action as {
          addChatItemAction?: {
            item?: { liveChatTextMessageRenderer?: ChatRenderer };
          };
        }
      ).addChatItemAction?.item?.liveChatTextMessageRenderer;
      if (!renderer) {
        continue;
      }
      const row = rendererToRow(videoId, renderer);
      if (row) {
        rows.push(row);
      }
    }
  }
  return rows;
}

function infoPublishedAt(info: {
  timestamp?: number;
  release_timestamp?: number;
  upload_date?: string;
}): string | null {
  const ts = info.release_timestamp ?? info.timestamp;
  if (ts) {
    return new Date(ts * 1000).toISOString();
  }
  if (info.upload_date && /^\d{8}$/.test(info.upload_date)) {
    const d = info.upload_date;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00.000Z`;
  }
  return null;
}

async function backfillVideo(videoId: string): Promise<number> {
  const tmp = mkdtempSync(join(tmpdir(), "yt-chat-"));
  try {
    await ytdlp([
      "--skip-download",
      "--write-subs",
      "--sub-langs",
      "live_chat",
      "--write-info-json",
      "--no-warnings",
      "-o",
      join(tmp, videoId),
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    let title: string | null = null;
    let publishedAt: string | null = null;
    const infoPath = join(tmp, `${videoId}.info.json`);
    if (existsSync(infoPath)) {
      const info = JSON.parse(readFileSync(infoPath, "utf8"));
      title = info.title ?? null;
      publishedAt = infoPublishedAt(info);
    }

    const chatPath = join(tmp, `${videoId}.live_chat.json`);
    const rows = existsSync(chatPath)
      ? parseLiveChatFile(videoId, chatPath)
      : [];

    const { error: vodError } = await admin.from("youtube_vods").upsert(
      {
        video_id: videoId,
        title,
        published_at: publishedAt,
        message_count: rows.length,
        backfilled_at: new Date().toISOString(),
      },
      { onConflict: "video_id" }
    );
    if (vodError) {
      throw new Error(vodError.message);
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await admin
        .from("youtube_chat_archive")
        .upsert(rows.slice(i, i + BATCH), {
          onConflict: "video_id,message_id",
          ignoreDuplicates: true,
        });
      if (error) {
        throw new Error(error.message);
      }
    }
    return rows.length;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function rebuildChatterStats(): Promise<number> {
  type Agg = {
    author_name: string | null;
    nameAt: string;
    total: number;
    videos: Set<string>;
    first: string;
    last: string;
  };
  const aggs = new Map<string, Agg>();

  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("youtube_chat_archive")
      .select("author_channel_id, author_name, video_id, published_at")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(error.message);
    }
    for (const r of data ?? []) {
      const agg = aggs.get(r.author_channel_id);
      if (!agg) {
        aggs.set(r.author_channel_id, {
          author_name: r.author_name,
          nameAt: r.published_at,
          total: 1,
          videos: new Set([r.video_id]),
          first: r.published_at,
          last: r.published_at,
        });
      } else {
        agg.total += 1;
        agg.videos.add(r.video_id);
        if (r.published_at < agg.first) agg.first = r.published_at;
        if (r.published_at > agg.last) agg.last = r.published_at;
        if (r.author_name && r.published_at >= agg.nameAt) {
          agg.author_name = r.author_name;
          agg.nameAt = r.published_at;
        }
      }
    }
    if ((data ?? []).length < PAGE) {
      break;
    }
  }

  const statRows = [...aggs.entries()].map(([author_channel_id, a]) => ({
    author_channel_id,
    author_name: a.author_name,
    total_messages: a.total,
    videos_attended: a.videos.size,
    first_seen_at: a.first,
    last_seen_at: a.last,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < statRows.length; i += BATCH) {
    const { error } = await admin
      .from("chatter_stats")
      .upsert(statRows.slice(i, i + BATCH), {
        onConflict: "author_channel_id",
      });
    if (error) {
      throw new Error(error.message);
    }
  }

  const keep = statRows.map((r) => r.author_channel_id);
  if (keep.length) {
    const { error } = await admin
      .from("chatter_stats")
      .delete()
      .not(
        "author_channel_id",
        "in",
        `(${keep.map((k) => `"${k}"`).join(",")})`
      );
    if (error) {
      console.error("stale stats cleanup failed:", error.message);
    }
  }
  return statRows.length;
}

async function main() {
  const channelId = await resolveChannelId();
  const sources: string[][] = [];
  if (channelId) {
    sources.push(await publicUploadIds(channelId));
  } else {
    console.error("no youtube_channel_id on any stream — skipping channel scan");
  }
  sources.push(await dbVideoIds());
  sources.push(fileVideoIds());

  const ids = [...new Set(sources.flat())];
  console.log(`candidate videos: ${ids.length}`);

  const { data: doneRows } = await admin
    .from("youtube_vods")
    .select("video_id");
  const done = new Set((doneRows ?? []).map((r) => r.video_id));

  let processed = 0;
  let newMessages = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const id of ids) {
    if (done.has(id) && !FORCE) {
      skipped += 1;
      continue;
    }
    try {
      const count = await backfillVideo(id);
      processed += 1;
      newMessages += count;
      console.log(`archived ${id}: ${count} messages`);
    } catch (e) {
      failures.push(`${id}: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  const chatters = await rebuildChatterStats();

  console.log("--- summary");
  console.log(`processed: ${processed}, skipped (already done): ${skipped}`);
  console.log(`new messages archived: ${newMessages}`);
  console.log(`chatter_stats rows: ${chatters}`);
  if (failures.length) {
    console.log(`failures (${failures.length}):`);
    for (const f of failures) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

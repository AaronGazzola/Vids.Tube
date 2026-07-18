"use server";

import type { ActionResult, Stream } from "@/app/layout.types";
import { ensureProcessingVod, publishVodForStream } from "@/lib/broadcast-end";
import { uploadToR2 } from "@/lib/r2";
import { isLiveAndFresh, STALE_MS } from "@/lib/stream";
import { isWorkerFresh } from "@/lib/worker-status";
import { fetchSubs, fetchVideoData, parseVideoId } from "@/lib/youtube";
import { supabaseAdmin } from "@/supabase/admin-client";
import { createClient } from "@/supabase/server-client";
import { randomBytes } from "crypto";

const THUMB_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_THUMB_SIZE = 5 * 1024 * 1024;

function generateStreamKey() {
  return `vt_live_${randomBytes(24).toString("hex")}`;
}

type OwnedChannel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  channel: { id: string; slug: string };
};

async function getOwnedChannel(): Promise<ActionResult<OwnedChannel>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: channel, error } = await supabase
    .from("channels")
    .select("id, slug")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load channel");
  }
  if (!channel) {
    return { error: "No channel found for your account." };
  }

  return { data: { supabase, channel } };
}

export type TranscriptSegment = { id: string; text: string; startS: number };

export async function getTranscriptAction(
  streamId: string
): Promise<TranscriptSegment[]> {
  const { data, error } = await supabaseAdmin
    .from("transcript_segments")
    .select("id, text, start_s")
    .eq("stream_id", streamId)
    .order("start_s", { ascending: true })
    .limit(500);
  if (error) {
    console.error(error);
    throw new Error("Failed to load transcript");
  }
  return (data ?? []).map((s) => ({ id: s.id, text: s.text, startS: s.start_s }));
}

export async function getWorkerStatusAction(): Promise<{
  running: boolean;
  lastHeartbeatAt: string | null;
}> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  const { data, error } = await supabaseAdmin
    .from("worker_heartbeats")
    .select("last_heartbeat_at")
    .eq("channel_id", channel.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load worker status");
  }

  const lastHeartbeatAt = data?.last_heartbeat_at ?? null;
  return { running: isWorkerFresh(lastHeartbeatAt), lastHeartbeatAt };
}

export async function getStreamKeyAction() {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { supabase, channel } = owned.data;

  const { data, error } = await supabase
    .from("stream_keys")
    .select("key")
    .eq("channel_id", channel.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load stream key");
  }

  return {
    channelId: channel.id,
    channelSlug: channel.slug,
    key: data?.key ?? null,
  };
}

export async function regenerateStreamKeyAction(): Promise<
  ActionResult<{ key: string }>
> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { supabase, channel } = owned.data;

  const key = generateStreamKey();
  const { error } = await supabase
    .from("stream_keys")
    .upsert({ channel_id: channel.id, key }, { onConflict: "channel_id" });

  if (error) {
    console.error(error);
    throw new Error("Failed to regenerate stream key");
  }

  return { data: { key } };
}

export async function getCurrentBroadcastAction(): Promise<Stream | null> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  // Resolve the single active broadcast (draft/scheduled/preview/live), not the
  // newest row — otherwise an already-ended stream pre-fills the /live form.
  const { data, error } = await supabaseAdmin
    .from("streams")
    .select("*")
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }

  return data;
}

// Capture the subs-goal baseline (current subscriber count) once, if not already
// captured at schedule time. Best-effort: a YouTube read failure must not block
// going live — the baseline defaults to 0 and can be re-derived. Likes/viewers
// are absolute (no baseline).
async function captureSubsBaselineIfUnset(stream: {
  id: string;
  youtube_video_id: string | null;
  youtube_channel_id: string | null;
}): Promise<void> {
  if (!stream.youtube_channel_id) {
    return;
  }
  const { data: goals } = await supabaseAdmin
    .from("stream_goals")
    .select("baseline_subs")
    .eq("stream_id", stream.id)
    .maybeSingle();
  if (goals && goals.baseline_subs != null) {
    return;
  }
  try {
    const subs = await fetchSubs(stream.youtube_channel_id);
    await supabaseAdmin.from("stream_goals").upsert(
      {
        stream_id: stream.id,
        baseline_subs: subs,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stream_id" }
    );
  } catch (e) {
    console.error(e);
  }
}

export async function goLiveAction(input: {
  title: string;
  description: string;
}): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const title = input.title.trim();
  if (!title) {
    return { error: "Add a title before going live." };
  }

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, thumbnail_path, youtube_video_id, youtube_channel_id")
    .eq("channel_id", channel.id)
    .in("status", ["preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || stream.status !== "preview") {
    return {
      error: "No connected stream to go live with. Start your encoder first.",
    };
  }

  const description = input.description.trim() || null;
  const { error: updateError } = await supabaseAdmin
    .from("streams")
    .update({
      status: "live",
      live_at: new Date().toISOString(),
      title,
      description,
    })
    .eq("id", stream.id)
    .eq("status", "preview");

  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to go live");
  }

  await captureSubsBaselineIfUnset(stream);

  // Create the processing VOD row now so a disconnect finalize has a row to bind
  // the recording to; it stays hidden until End.
  await ensureProcessingVod({
    id: stream.id,
    channel_id: channel.id,
    title,
    description,
    thumbnail_path: stream.thumbnail_path,
  });

  return { data: { id: stream.id } };
}

// Create or update the single active broadcast from the UI. Undated -> draft
// (private); dated -> scheduled (public waiting room). Edits the existing active
// row when one exists rather than creating a second (the partial unique index
// enforces one active row per channel).
export async function upsertBroadcastAction(input: {
  title: string;
  description: string;
  scheduledStartAt: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const title = input.title.trim();
  const description = input.description.trim() || null;
  const scheduledStartAt = input.scheduledStartAt;
  const nextStatus = scheduledStartAt ? "scheduled" : "draft";

  const { data: active, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, youtube_video_id, youtube_channel_id")
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }

  if (active && (active.status === "preview" || active.status === "live")) {
    // Connected/live: only edit metadata + schedule, never flip status.
    const { error: updateError } = await supabaseAdmin
      .from("streams")
      .update({
        title: title || null,
        description,
        scheduled_start_at: scheduledStartAt,
      })
      .eq("id", active.id);
    if (updateError) {
      console.error(updateError);
      throw new Error("Failed to save broadcast");
    }
    if (scheduledStartAt) {
      await captureSubsBaselineIfUnset(active);
    }
    return { data: { id: active.id } };
  }

  if (active) {
    const { error: updateError } = await supabaseAdmin
      .from("streams")
      .update({
        status: nextStatus,
        title: title || null,
        description,
        scheduled_start_at: scheduledStartAt,
      })
      .eq("id", active.id)
      .in("status", ["draft", "scheduled"]);
    if (updateError) {
      console.error(updateError);
      throw new Error("Failed to save broadcast");
    }
    if (scheduledStartAt) {
      await captureSubsBaselineIfUnset(active);
    }
    return { data: { id: active.id } };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("streams")
    .insert({
      channel_id: channel.id,
      status: nextStatus,
      created_in_ui: true,
      title: title || null,
      description,
      scheduled_start_at: scheduledStartAt,
    })
    .select("id")
    .single();
  if (insertError) {
    console.error(insertError);
    throw new Error("Failed to create broadcast");
  }
  return { data: { id: inserted.id } };
}

// Cancel the active broadcast before go-live. A draft/scheduled row (no encoder)
// is deleted outright. A preview row (encoder connected) is reset in place to a
// blank private ad-hoc preview, since the still-connected encoder would
// otherwise immediately recreate one.
export async function discardBroadcastAction(): Promise<
  ActionResult<{ discarded: "deleted" | "reset" }>
> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: active, error } = await supabaseAdmin
    .from("streams")
    .select("id, status")
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!active) {
    return { error: "No broadcast to discard." };
  }
  if (active.status === "live") {
    return { error: "End the stream instead of discarding while live." };
  }

  if (active.status === "draft" || active.status === "scheduled") {
    const { error: deleteError } = await supabaseAdmin
      .from("streams")
      .delete()
      .eq("id", active.id)
      .in("status", ["draft", "scheduled"]);
    if (deleteError) {
      console.error(deleteError);
      throw new Error("Failed to discard broadcast");
    }
    return { data: { discarded: "deleted" } };
  }

  // preview: reset to a blank ad-hoc preview and drop per-stream config.
  await supabaseAdmin.from("stream_goals").delete().eq("stream_id", active.id);
  await supabaseAdmin
    .from("chat_scoring_state")
    .delete()
    .eq("stream_id", active.id);

  const { error: resetError } = await supabaseAdmin
    .from("streams")
    .update({
      scheduled_start_at: null,
      created_in_ui: false,
      title: null,
      description: null,
      thumbnail_path: null,
      youtube_video_id: null,
      youtube_channel_id: null,
      waiting_room_chat: false,
    })
    .eq("id", active.id)
    .eq("status", "preview");
  if (resetError) {
    console.error(resetError);
    throw new Error("Failed to discard broadcast");
  }
  return { data: { discarded: "reset" } };
}

const DEFAULT_GOAL_TARGETS = { subs: 1000, likes: 500, viewers: 100 };

export type StreamSettings = {
  streamId: string | null;
  status: string;
  channelSlug: string;
  title: string;
  description: string;
  scheduledStartAt: string | null;
  youtubeVideoId: string | null;
  goals: { subs: number; likes: number; viewers: number };
  scoringEnabled: boolean;
  banMode: "suggest" | "auto";
  ttsMode: "suggest" | "auto";
  askMode: "suggest" | "auto";
  highlightingEnabled: boolean;
  autoDisplayFeatured: boolean;
  waitingRoomChat: boolean;
  disabledCommands: string[];
  workerRunning: boolean;
};

export type StreamSettingsInput = {
  title: string;
  description: string;
  scheduledStartAt: string | null;
  youtubeUrl: string;
  goals: { subs: number; likes: number; viewers: number };
  scoringEnabled: boolean;
  banMode: "suggest" | "auto";
  ttsMode: "suggest" | "auto";
  askMode: "suggest" | "auto";
  highlightingEnabled: boolean;
  autoDisplayFeatured: boolean;
  waitingRoomChat: boolean;
  disabledCommands: string[];
};

export async function getStreamSettingsAction(): Promise<StreamSettings> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    throw new Error(owned.error);
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select(
      "id, status, title, description, scheduled_start_at, youtube_video_id, waiting_room_chat, disabled_commands"
    )
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load settings");
  }

  const { data: heartbeat } = await supabaseAdmin
    .from("worker_heartbeats")
    .select("last_heartbeat_at")
    .eq("channel_id", channel.id)
    .maybeSingle();
  const workerRunning = isWorkerFresh(heartbeat?.last_heartbeat_at ?? null);

  if (!stream) {
    return {
      streamId: null,
      status: "none",
      channelSlug: channel.slug,
      title: "",
      description: "",
      scheduledStartAt: null,
      youtubeVideoId: null,
      goals: { ...DEFAULT_GOAL_TARGETS },
      scoringEnabled: false,
      banMode: "suggest",
      ttsMode: "suggest",
      askMode: "suggest",
      highlightingEnabled: true,
      autoDisplayFeatured: false,
      waitingRoomChat: false,
      disabledCommands: [],
      workerRunning,
    };
  }

  const { data: goals } = await supabaseAdmin
    .from("stream_goals")
    .select("subs_goal, likes_goal, viewers_goal")
    .eq("stream_id", stream.id)
    .maybeSingle();
  const { data: scoring } = await supabaseAdmin
    .from("chat_scoring_state")
    .select(
      "enabled, moderation_mode, tts_mode, ask_mode, highlighting_enabled, auto_display_featured"
    )
    .eq("stream_id", stream.id)
    .maybeSingle();

  return {
    streamId: stream.id,
    status: stream.status,
    channelSlug: channel.slug,
    title: stream.title ?? "",
    description: stream.description ?? "",
    scheduledStartAt: stream.scheduled_start_at,
    youtubeVideoId: stream.youtube_video_id,
    goals: {
      subs: goals?.subs_goal ?? DEFAULT_GOAL_TARGETS.subs,
      likes: goals?.likes_goal ?? DEFAULT_GOAL_TARGETS.likes,
      viewers: goals?.viewers_goal ?? DEFAULT_GOAL_TARGETS.viewers,
    },
    scoringEnabled: scoring?.enabled ?? false,
    banMode: scoring?.moderation_mode === "auto" ? "auto" : "suggest",
    ttsMode: scoring?.tts_mode === "auto" ? "auto" : "suggest",
    askMode: scoring?.ask_mode === "auto" ? "auto" : "suggest",
    highlightingEnabled: scoring?.highlighting_enabled ?? true,
    autoDisplayFeatured: scoring?.auto_display_featured ?? false,
    waitingRoomChat: stream.waiting_room_chat ?? false,
    disabledCommands: stream.disabled_commands ?? [],
    workerRunning,
  };
}

// One save path for the whole Settings form (spec: no per-section save buttons).
// Persists the streams row, goals, scoring/mod settings, YouTube video, and the
// waiting-room toggle together; creates a draft/scheduled row if none is active.
export async function saveStreamSettingsAction(
  input: StreamSettingsInput
): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: active, error } = await supabaseAdmin
    .from("streams")
    .select("id, status, scheduled_start_at, youtube_video_id, youtube_channel_id")
    .eq("channel_id", channel.id)
    .in("status", ["draft", "scheduled", "preview", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }

  const title = input.title.trim() || null;
  const description = input.description.trim() || null;
  const scheduledStartAt = input.scheduledStartAt;
  const isConnected =
    active?.status === "preview" || active?.status === "live";
  const previousScheduledAt = active?.scheduled_start_at ?? null;

  // 1. Upsert the stream row.
  let streamId: string;
  let youtubeChannelId = active?.youtube_channel_id ?? null;
  if (active) {
    const update: {
      title: string | null;
      description: string | null;
      waiting_room_chat: boolean;
      disabled_commands: string[];
      scheduled_start_at?: string | null;
      status?: string;
    } = {
      title,
      description,
      waiting_room_chat: input.waitingRoomChat,
      disabled_commands: input.disabledCommands,
    };
    // Don't flip a live row's status/schedule; a preview can still be scheduled.
    if (active.status !== "live") {
      update.scheduled_start_at = scheduledStartAt;
      if (!isConnected) {
        update.status = scheduledStartAt ? "scheduled" : "draft";
      }
    }
    const { error: updateError } = await supabaseAdmin
      .from("streams")
      .update(update)
      .eq("id", active.id);
    if (updateError) {
      console.error(updateError);
      throw new Error("Failed to save broadcast");
    }
    streamId = active.id;
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("streams")
      .insert({
        channel_id: channel.id,
        status: scheduledStartAt ? "scheduled" : "draft",
        created_in_ui: true,
        title,
        description,
        scheduled_start_at: scheduledStartAt,
        waiting_room_chat: input.waitingRoomChat,
        disabled_commands: input.disabledCommands,
      })
      .select("id")
      .single();
    if (insertError) {
      console.error(insertError);
      throw new Error("Failed to create broadcast");
    }
    streamId = inserted.id;
  }

  // 2. YouTube video — only refetch when the parsed id actually changes.
  const trimmedYoutube = input.youtubeUrl.trim();
  if (!trimmedYoutube) {
    if (active?.youtube_video_id) {
      await supabaseAdmin
        .from("streams")
        .update({ youtube_video_id: null, youtube_channel_id: null })
        .eq("id", streamId);
      youtubeChannelId = null;
    }
  } else {
    const videoId = parseVideoId(trimmedYoutube);
    if (!videoId) {
      return { error: "Couldn't read a YouTube video id from that URL." };
    }
    if (videoId !== active?.youtube_video_id) {
      try {
        const video = await fetchVideoData(videoId);
        youtubeChannelId = video.channelId || null;
      } catch (e) {
        console.error(e);
        return {
          error:
            "Couldn't fetch that YouTube video — check the URL and that it's public.",
        };
      }
      await supabaseAdmin
        .from("streams")
        .update({
          youtube_video_id: videoId,
          youtube_channel_id: youtubeChannelId,
        })
        .eq("id", streamId);
    }
  }

  // 3. Goal targets.
  const { error: goalsError } = await supabaseAdmin.from("stream_goals").upsert(
    {
      stream_id: streamId,
      subs_goal: Math.max(0, Math.round(input.goals.subs)),
      likes_goal: Math.max(0, Math.round(input.goals.likes)),
      viewers_goal: Math.max(0, Math.round(input.goals.viewers)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stream_id" }
  );
  if (goalsError) {
    console.error(goalsError);
    throw new Error("Failed to save goals");
  }

  // 4. Scoring + moderation settings.
  const { error: scoringError } = await supabaseAdmin
    .from("chat_scoring_state")
    .upsert(
      {
        stream_id: streamId,
        enabled: input.scoringEnabled,
        moderation_mode: input.banMode === "auto" ? "auto" : "manual",
        tts_mode: input.ttsMode === "auto" ? "auto" : "suggest",
        ask_mode: input.askMode === "auto" ? "auto" : "suggest",
        highlighting_enabled: input.highlightingEnabled,
        auto_display_featured: input.autoDisplayFeatured,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stream_id" }
    );
  if (scoringError) {
    console.error(scoringError);
    throw new Error("Failed to save scoring settings");
  }

  // 5. Recapture the subs baseline when a datetime is newly added (progress
  // restarts on schedule).
  if (scheduledStartAt && !previousScheduledAt && youtubeChannelId) {
    try {
      const subs = await fetchSubs(youtubeChannelId);
      await supabaseAdmin.from("stream_goals").upsert(
        {
          stream_id: streamId,
          baseline_subs: subs,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stream_id" }
      );
    } catch (e) {
      console.error(e);
    }
  }

  return { data: { id: streamId } };
}

export async function endStreamAction(): Promise<ActionResult<{ id: string }>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, channel_id, status, last_seen_at")
    .eq("channel_id", channel.id)
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream) {
    return { error: "No live broadcast to end." };
  }

  // End is only allowed once the encoder is disconnected; otherwise the still-
  // connected encoder would immediately respawn an ad-hoc preview.
  if (isLiveAndFresh(stream, Date.now(), STALE_MS)) {
    return {
      error:
        "Your encoder is still connected. Stop the stream in OBS first, then end it here.",
    };
  }

  const nowIso = new Date().toISOString();

  // Close any open reconnect gap so the VOD's chat replay math is bounded.
  await supabaseAdmin
    .from("stream_gaps")
    .update({ gap_end_at: nowIso })
    .eq("stream_id", stream.id)
    .is("gap_end_at", null);

  const { error: endError } = await supabaseAdmin
    .from("streams")
    .update({ status: "ended", ended_at: nowIso })
    .eq("id", stream.id)
    .eq("status", "live");
  if (endError) {
    console.error(endError);
    throw new Error("Failed to end broadcast");
  }

  // Publish the VOD if its recording already finalized; otherwise the recording
  // hook publishes it when the finalize lands (it gates on the stream being ended).
  await publishVodForStream(stream.id);

  return { data: { id: stream.id } };
}

export async function uploadBroadcastThumbnailAction(
  formData: FormData
): Promise<ActionResult<string>> {
  const owned = await getOwnedChannel();
  if ("error" in owned) {
    return { error: owned.error };
  }
  const { channel } = owned.data;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file provided." };
  }
  const ext = THUMB_MIME_EXT[file.type];
  if (!ext) {
    return { error: "Unsupported file type — use JPG, PNG, or WebP." };
  }
  if (file.size > MAX_THUMB_SIZE) {
    return { error: "File too large — thumbnail must be 5 MB or smaller." };
  }

  const { data: stream, error } = await supabaseAdmin
    .from("streams")
    .select("id, status")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("Failed to load broadcast");
  }
  if (!stream || (stream.status !== "preview" && stream.status !== "live")) {
    return { error: "Start your encoder before setting a thumbnail." };
  }

  const key = `live-thumb/${channel.id}/${stream.id}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await uploadToR2(key, bytes, file.type);
  } catch (uploadError) {
    console.error(uploadError);
    throw new Error("Failed to upload thumbnail");
  }

  const { error: updateError } = await supabaseAdmin
    .from("streams")
    .update({ thumbnail_path: key })
    .eq("id", stream.id);

  if (updateError) {
    console.error(updateError);
    throw new Error("Failed to save thumbnail");
  }

  return { data: key };
}

import { parseChatCommand } from "@/lib/chat-commands";
import type { BufferedMessage } from "../jobs/score";
import { deliverReply } from "./replies";
import { supabaseAdmin } from "../supabase";

export type CommandRegistryRow = {
  id: string;
  keyword: string;
  kind: string;
  builtin_key: string | null;
  description: string;
  response: string | null;
  cooldown_s: number;
  max_per_stream: number | null;
  enabled: boolean;
  sort_order: number;
};

export type CommandStreamInfo = {
  id: string;
  channelId: string;
  channelSlug: string;
  disabledCommands: string[];
};

export type CommandContext = {
  stream: CommandStreamInfo;
  message: BufferedMessage;
  args: string;
  registry: CommandRegistryRow[];
  reply: (text: string) => void;
};

const REGISTRY_TTL_MS = 30_000;

let registryCache: {
  channelId: string;
  loadedAt: number;
  rows: CommandRegistryRow[];
} | null = null;

export async function loadCommandRegistry(
  channelId: string
): Promise<CommandRegistryRow[]> {
  if (
    registryCache &&
    registryCache.channelId === channelId &&
    Date.now() - registryCache.loadedAt < REGISTRY_TTL_MS
  ) {
    return registryCache.rows;
  }
  const { data, error } = await supabaseAdmin
    .from("chat_commands")
    .select(
      "id, keyword, kind, builtin_key, description, response, cooldown_s, max_per_stream, enabled, sort_order"
    )
    .eq("channel_id", channelId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error(error);
    return registryCache?.rows ?? [];
  }
  registryCache = { channelId, loadedAt: Date.now(), rows: data ?? [] };
  return registryCache.rows;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://vids.tube";
}

export const BUILTIN_HANDLERS: Record<
  string,
  (ctx: CommandContext) => Promise<void>
> = {
  help: async (ctx) => {
    const enabled = ctx.registry.filter((r) => r.enabled);
    const list = enabled.map((r) => `!${r.keyword}`).join(" ");
    ctx.reply(
      `Commands: ${list} — full guide: ${siteUrl()}/${ctx.stream.channelSlug}/commands`
    );
  },
  me: async (ctx) => {
    const { meHandler } = await import("./me-command");
    await meHandler(ctx);
  },
  rank: async (ctx) => {
    const { rankHandler } = await import("./info-commands");
    await rankHandler(ctx);
  },
  top: async (ctx) => {
    const { topHandler } = await import("./info-commands");
    await topHandler(ctx);
  },
  goal: async (ctx) => {
    const { goalHandler } = await import("./info-commands");
    await goalHandler(ctx);
  },
  uptime: async (ctx) => {
    const { uptimeHandler } = await import("./info-commands");
    await uptimeHandler(ctx);
  },
  tts: async (ctx) => {
    const { ttsHandler } = await import("./tts");
    await ttsHandler(ctx);
  },
  ask: async (ctx) => {
    const { askHandler } = await import("./ask-command");
    await askHandler(ctx);
  },
  catchup: async (ctx) => {
    const { catchupHandler } = await import("./catchup-command");
    await catchupHandler(ctx);
  },
  clip: async (ctx) => {
    const { clipHandler } = await import("./clip-command");
    await clipHandler(ctx);
  },
};

function commandParticipantKey(m: BufferedMessage): string {
  return m.origin === "vidstube"
    ? String(m.userId)
    : `youtube:${m.externalAuthorId}`;
}

type EventStatus = "executed" | "cooldown" | "limit" | "disabled" | "unknown";

async function insertEvent(
  stream: CommandStreamInfo,
  m: BufferedMessage,
  keyword: string,
  args: string,
  status: EventStatus,
  reply: string | null
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("command_events")
    .insert({
      channel_id: stream.channelId,
      stream_id: stream.id,
      chat_message_id: m.chatMessageId,
      origin: m.origin,
      participant_key: commandParticipantKey(m),
      keyword,
      args: args || null,
      status,
      reply,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data?.id ?? null;
}

// Runs the command layer over a ban-filtered batch from both chat origins.
// Command messages (known or attempted) are consumed here and never scored;
// the returned array is what the scoring prompt should see.
export async function processCommands(
  stream: CommandStreamInfo,
  batch: BufferedMessage[]
): Promise<BufferedMessage[]> {
  const nonCommands: BufferedMessage[] = [];
  let registry: CommandRegistryRow[] | null = null;

  for (const m of batch) {
    const parsed = parseChatCommand(m.text);
    if (!parsed) {
      nonCommands.push(m);
      continue;
    }
    registry = registry ?? (await loadCommandRegistry(stream.channelId));
    const row = registry.find((r) => r.keyword === parsed.keyword) ?? null;
    const pkey = commandParticipantKey(m);

    if (!row) {
      const { count, error } = await supabaseAdmin
        .from("command_events")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", stream.id)
        .eq("participant_key", pkey)
        .eq("status", "unknown");
      if (error) {
        console.error(error);
        continue;
      }
      if (!count) {
        const pointer = "Unknown command — try !help";
        await insertEvent(
          stream,
          m,
          parsed.keyword,
          parsed.args,
          "unknown",
          pointer
        );
        await deliverReply({
          streamId: stream.id,
          origin: m.origin,
          text: pointer,
        });
      }
      continue;
    }

    if (!row.enabled || stream.disabledCommands.includes(row.keyword)) {
      await insertEvent(stream, m, row.keyword, parsed.args, "disabled", null);
      continue;
    }

    if (row.cooldown_s > 0) {
      const sinceIso = new Date(
        Date.now() - row.cooldown_s * 1000
      ).toISOString();
      const { count, error } = await supabaseAdmin
        .from("command_events")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", stream.id)
        .eq("participant_key", pkey)
        .eq("keyword", row.keyword)
        .eq("status", "executed")
        .gte("created_at", sinceIso);
      if (error) {
        console.error(error);
        continue;
      }
      if (count) {
        await insertEvent(stream, m, row.keyword, parsed.args, "cooldown", null);
        continue;
      }
    }

    if (row.max_per_stream != null) {
      const { count, error } = await supabaseAdmin
        .from("command_events")
        .select("id", { count: "exact", head: true })
        .eq("stream_id", stream.id)
        .eq("participant_key", pkey)
        .eq("keyword", row.keyword)
        .eq("status", "executed");
      if (error) {
        console.error(error);
        continue;
      }
      if ((count ?? 0) >= row.max_per_stream) {
        await insertEvent(stream, m, row.keyword, parsed.args, "limit", null);
        continue;
      }
    }

    const eventId = await insertEvent(
      stream,
      m,
      row.keyword,
      parsed.args,
      "executed",
      null
    );

    let replyText: string | null = null;
    if (row.kind === "custom") {
      replyText = row.response?.trim() || null;
    } else {
      const handler = row.builtin_key
        ? BUILTIN_HANDLERS[row.builtin_key]
        : null;
      if (!handler) {
        continue;
      }
      const ctx: CommandContext = {
        stream,
        message: m,
        args: parsed.args,
        registry,
        reply: (text: string) => {
          replyText = text;
        },
      };
      try {
        await handler(ctx);
      } catch (e) {
        console.error(`command !${row.keyword} handler failed:`, e);
        continue;
      }
    }
    if (replyText) {
      if (eventId) {
        const { error } = await supabaseAdmin
          .from("command_events")
          .update({ reply: replyText })
          .eq("id", eventId);
        if (error) {
          console.error(error);
        }
      }
      await deliverReply({
        streamId: stream.id,
        origin: m.origin,
        text: replyText,
      });
    }
  }

  return nonCommands;
}

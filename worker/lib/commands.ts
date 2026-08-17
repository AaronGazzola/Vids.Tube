import { parseChatCommand } from "@/lib/chat-commands";
import type { BufferedMessage } from "../jobs/score";
import { deliverReply } from "./replies";
import { shouldCharge } from "./credits";
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
  credit_cost: number;
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
      "id, keyword, kind, builtin_key, description, response, cooldown_s, max_per_stream, enabled, sort_order, credit_cost"
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
  voices: async (ctx) => {
    const { voicesHandler } = await import("./tts");
    await voicesHandler(ctx);
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

// What the scorer sees. A command message stays in: it is chat like any other
// line and may be featured. Only the host drops out, because the host owns the
// broadcast rather than competing in it.
export function scorableMessages<T extends { isHost?: boolean }>(
  batch: T[]
): T[] {
  return batch.filter((m) => !m.isHost);
}

export function cooldownWaitSeconds(
  lastExecutedIso: string,
  cooldownS: number,
  now: number
): number {
  const readyAt = new Date(lastExecutedIso).getTime() + cooldownS * 1000;
  return Math.max(1, Math.ceil((readyAt - now) / 1000));
}

function mention(m: BufferedMessage): string {
  return `@${(m.authorName ?? m.author).replace(/^@+/, "")}`;
}

// Same rule as the generated `viewer_scores.participant_key`: the Vids.Tube
// account wins whenever the message carries one. Chat ingest stamps the account
// on a YouTube message from the recognised host, so the host is one participant
// in both chats rather than two.
export function commandParticipantKey(m: {
  userId: string | null;
  externalAuthorId: string | null;
}): string {
  return m.userId ? String(m.userId) : `youtube:${m.externalAuthorId}`;
}

// `insufficient` is its own outcome rather than folded into `limit`: the log
// exists to answer why a command did not run, and "could not afford it" is a
// different answer from "used it too many times".
type EventStatus =
  | "executed"
  | "cooldown"
  | "limit"
  | "disabled"
  | "unknown"
  | "insufficient";

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
// Command messages (known or attempted) are dispatched here and returned to the
// caller minus themselves: the returned array is what may be echoed back to
// YouTube chat, since bridging a command would replay it at its own chat.
//
// It is NOT the scoring batch. A command message is scored and featurable like
// any other line, so the caller scores what it passed in, not what it gets back.
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
      const { data: last, error } = await supabaseAdmin
        .from("command_events")
        .select("created_at")
        .eq("stream_id", stream.id)
        .eq("participant_key", pkey)
        .eq("keyword", row.keyword)
        .eq("status", "executed")
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error(error);
        continue;
      }
      if (last) {
        const wait = cooldownWaitSeconds(
          last.created_at,
          row.cooldown_s,
          Date.now()
        );
        const text = `${mention(m)} !${row.keyword} is on cooldown — try again in ${wait}s.`;
        await insertEvent(stream, m, row.keyword, parsed.args, "cooldown", text);
        await deliverReply({ streamId: stream.id, origin: m.origin, text });
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

    // Charged last of all the checks, so a chatter is never billed for a
    // command that was going to be refused anyway. A free command — which is
    // every command whose price has not been set — costs no lookup at all.
    if (shouldCharge(row, m)) {
      const { chargeCommand, insufficientReply, resolveMembershipId } =
        await import("./credits");
      const membershipId = await resolveMembershipId(m, stream.channelId);
      const outcome = membershipId
        ? await chargeCommand({
            membershipId,
            amount: row.credit_cost,
            sourceId: m.chatMessageId ?? `${stream.id}:${m.ref}`,
          })
        : ({ charged: false, balance: null } as const);

      if (!outcome.charged) {
        const text = insufficientReply({
          mention: mention(m),
          keyword: row.keyword,
          amount: row.credit_cost,
          balance: outcome.balance,
        });
        await insertEvent(
          stream,
          m,
          row.keyword,
          parsed.args,
          "insufficient",
          text
        );
        await deliverReply({ streamId: stream.id, origin: m.origin, text });
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

    // A command belonging to a framed overlay is delivered by the row just
    // written: the overlay polls for its own executions and acts on them. There
    // is deliberately no reply, and deliberately no handler — a handler map is
    // what makes routing something somebody has to edit for each new game.
    //
    // Written explicitly rather than left to fall through the handler lookup
    // below, which would also do nothing, but only by accident.
    if (row.kind === "overlay") {
      continue;
    }

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

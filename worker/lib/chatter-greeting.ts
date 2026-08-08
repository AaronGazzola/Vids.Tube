import type { BufferedMessage } from "../jobs/score";

// YouTube accepts 200 characters. A greeting that spilled past it would be split
// in half by the chunker and arrive with its link broken across two messages, so
// every builder here fits the limit by construction rather than by hope.
export const MAX_GREETING_CHARS = 200;

// Each send occupies chat for about 5.2 seconds. Recent broadcasts draw 2 to 8
// chatters, so individual greetings are the normal path; the combined message is
// the safety valve for the broadcast that unexpectedly draws hundreds.
export const BATCH_THRESHOLD = 5;

export function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://vids.tube";
}

// The scheme is what makes YouTube render this as a link, and the community is a
// query parameter rather than a fragment because a fragment is the part of a URL
// a linkifier is most likely to drop.
export function memberLink(handle: string, communitySlug: string): string {
  return `${siteOrigin()}/${handle}?c=${communitySlug}`;
}

// The bare address, spoken on stream and printed on the overlay. Read, not
// clicked, so it carries no scheme.
export function siteLabel(): string {
  return siteOrigin().replace(/^https?:\/\//, "");
}

function mention(displayName: string): string {
  return `@${displayName.replace(/^@+/, "")}`;
}

// Clips the one variable part of a greeting so the fixed parts — the mention and
// the link — always survive intact.
function fit(prefix: string, variable: string, suffix: string): string {
  const budget = MAX_GREETING_CHARS - prefix.length - suffix.length;
  const clean = variable.replace(/\s+/g, " ").trim();
  if (clean.length <= budget) {
    return `${prefix}${clean}${suffix}`;
  }
  if (budget <= 1) {
    return `${prefix}${suffix}`.slice(0, MAX_GREETING_CHARS);
  }
  const slice = clean.slice(0, budget - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > budget / 2 ? slice.slice(0, lastSpace) : slice;
  return `${prefix}${cut}…${suffix}`;
}

export function buildNewMemberGreeting(input: {
  displayName: string;
  handle: string | null;
  communitySlug: string;
  memberNumber: number;
}): string {
  const who = mention(input.displayName);
  // A handle that is still a guess will be rewritten by the enrichment run, so
  // the link would rot. Name the shared address instead of publishing it.
  const tail = input.handle
    ? ` Your page: ${memberLink(input.handle, input.communitySlug)}`
    : ` Find yourself at ${siteLabel()}`;
  return fit(
    `${who} `,
    `welcome in — you're member #${input.memberNumber} of the community!`,
    tail
  );
}

export function buildReturningGreeting(input: {
  displayName: string;
  handle: string | null;
  communitySlug: string;
  shortLine: string | null;
  messageCount: number;
  streamsAttended: number;
  level: number;
  credits: number;
}): string {
  const who = mention(input.displayName);
  const link = input.handle
    ? ` ${memberLink(input.handle, input.communitySlug)}`
    : ` Find yourself at ${siteLabel()}`;
  // A returning member has something banked, so the balance is worth saying. A
  // balance of nothing is not, and saying "0 credits" to someone coming back
  // reads as a rebuke rather than a welcome.
  const purse =
    input.credits > 0
      ? ` You're on ${input.credits.toLocaleString("en-US")} credit${input.credits === 1 ? "" : "s"}.`
      : "";
  // When Claude's short line is missing, the member's own numbers are still
  // personal and always available, so the greeting never falls back to nothing.
  const body =
    input.shortLine ??
    `${input.messageCount.toLocaleString("en-US")} messages across ${input.streamsAttended} stream${input.streamsAttended === 1 ? "" : "s"}, level ${input.level}.`;
  return fit(`${who} welcome back — `, body, `${purse}${link}`);
}

export function buildBatchGreeting(
  displayNames: string[],
  memberCount: number
): string {
  const names = displayNames.map(mention).join(" ");
  return fit(
    "Welcome in ",
    names,
    ` — you're all members now (${memberCount} of us). Find yourself at ${siteLabel()}`
  );
}

export type PendingGreeting = {
  channelId: string;
  handle: string | null;
  displayName: string;
  isNew: boolean;
  sample: BufferedMessage;
};

// Held per stream in the worker process. Durability is not this map's job: a
// greeting is claimed in `stream_greetings` before it is sent, so a restart
// mid-broadcast cannot produce a second greeting for anyone.
const pending = new Map<string, PendingGreeting[]>();

export function queuePendingGreeting(
  streamId: string,
  entry: PendingGreeting
): void {
  const list = pending.get(streamId) ?? [];
  if (list.some((p) => p.channelId === entry.channelId)) return;
  list.push(entry);
  pending.set(streamId, list);
}

export function takePendingGreetings(streamId: string): PendingGreeting[] {
  const list = pending.get(streamId) ?? [];
  pending.set(streamId, []);
  return list;
}

export function clearPendingGreetings(streamId: string): void {
  pending.delete(streamId);
}

// Imported lazily so the builders above stay testable without worker env.
async function deps() {
  const [{ supabaseAdmin }, { deliverReply }, me] = await Promise.all([
    import("../supabase"),
    import("./replies"),
    import("./me-command"),
  ]);
  return { supabaseAdmin, deliverReply, me };
}

// The claim is written before the send, so a rejected duplicate is what stops a
// second greeting rather than a check that could race with itself.
export async function claimGreeting(
  streamId: string,
  channelId: string,
  kind: "new" | "returning" | "batch"
): Promise<boolean> {
  const { supabaseAdmin } = await deps();
  const { error } = await supabaseAdmin.from("stream_greetings").insert({
    stream_id: streamId,
    channel_id: channelId,
    kind,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error(`greeting claim failed for ${channelId}:`, error.message);
  return false;
}

async function membershipNumbers(
  channelId: string,
  communityId: string
): Promise<{
  messageCount: number;
  streamsAttended: number;
  level: number;
  credits: number;
}> {
  const { supabaseAdmin } = await deps();
  const { data } = await supabaseAdmin
    .from("memberships")
    .select("message_count, streams_attended, level, credits")
    .eq("channel_id", channelId)
    .eq("community_channel_id", communityId)
    .maybeSingle();
  return {
    messageCount: data?.message_count ?? 0,
    streamsAttended: data?.streams_attended ?? 0,
    level: data?.level ?? 0,
    credits: Number(data?.credits ?? 0),
  };
}

// The participant key a ban is recorded against, matching how the scorer keys
// the same chatter.
function bannedKeyFor(p: PendingGreeting): string {
  return p.sample.origin === "vidstube"
    ? String(p.sample.userId)
    : `youtube:${p.sample.externalAuthorId}`;
}

export async function runChatterGreetings(opts: {
  streamId: string;
  communityId: string;
  communitySlug: string;
  greetReturning: boolean;
  bannedKeys?: Set<string>;
}): Promise<void> {
  // Greetings are queued during the chat poll, which runs before the batch is
  // moderated, so the ban check has to happen here. Without it the bot would
  // welcome someone the owner has banned from the community.
  const banned = opts.bannedKeys ?? new Set<string>();
  const waiting = takePendingGreetings(opts.streamId).filter(
    (p) => (p.isNew || opts.greetReturning) && !banned.has(bannedKeyFor(p))
  );
  if (!waiting.length) return;

  const { supabaseAdmin, deliverReply, me } = await deps();

  const { data: memberCount } = await supabaseAdmin.rpc(
    "community_member_count",
    { p_community: opts.communityId }
  );
  const total = memberCount ?? 0;

  if (waiting.length > BATCH_THRESHOLD) {
    const claimed: PendingGreeting[] = [];
    for (const p of waiting) {
      if (await claimGreeting(opts.streamId, p.channelId, "batch")) {
        claimed.push(p);
      }
    }
    if (!claimed.length) return;
    console.error(`[greet] batching ${claimed.length} arrivals`);
    await deliverReply({
      streamId: opts.streamId,
      origin: "youtube",
      text: buildBatchGreeting(
        claimed.map((p) => p.displayName),
        total
      ),
    });
    return;
  }

  for (const p of waiting) {
    const kind = p.isNew ? "new" : "returning";
    if (!(await claimGreeting(opts.streamId, p.channelId, kind))) continue;

    // `handle` is already null when the channel is still awaiting enrichment,
    // set at the point the greeting was queued: a guessed handle is about to be
    // rewritten, so no personal link is published for it.
    const handle = p.handle;

    if (p.isNew) {
      await deliverReply({
        streamId: opts.streamId,
        origin: "youtube",
        text: buildNewMemberGreeting({
          displayName: p.displayName,
          handle,
          communitySlug: opts.communitySlug,
          memberNumber: total,
        }),
      });
      console.error(`[greet] new member @${p.handle ?? "?"} (#${total})`);
      continue;
    }

    let shortLine: string | null = null;
    try {
      const identity = await me.resolveMeIdentity(p.sample, opts.communityId);
      const stats = await me.gatherMeStats(identity);
      const profile = await me.ensureMeProfile(identity, opts.streamId, stats);
      shortLine = profile.shortLine;
    } catch (e) {
      console.error(`greeting profile failed for ${p.displayName}:`, e);
    }

    const numbers = await membershipNumbers(p.channelId, opts.communityId);
    await deliverReply({
      streamId: opts.streamId,
      origin: "youtube",
      text: buildReturningGreeting({
        displayName: p.displayName,
        handle,
        communitySlug: opts.communitySlug,
        shortLine,
        ...numbers,
      }),
    });
    console.error(`[greet] welcome back @${p.handle ?? "?"}`);
  }
}

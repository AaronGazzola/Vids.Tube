import type { BufferedMessage } from "../jobs/score";
import { MAX_GREETING_CHARS as MAX_REPLY_CHARS } from "./chatter-greeting";

// Charging a command, and nothing else. The ledger already knows how to spend:
// `spend_credits` refuses a spend the balance cannot cover and keeps the cached
// balance on the membership in step. There is deliberately no second spend path
// here, because two of them would eventually disagree.

// Whether a command costs this chatter anything at all, decided before any
// lookup happens. Free is the answer for every command whose price has not been
// set, and for the host whatever the price: the host owns the community rather
// than belonging to it, so there is no membership of theirs to charge.
//
// Pure and separate from the charging so that "a free command costs no database
// round trip" is a fact that can be asserted rather than a hope.
export function shouldCharge(
  row: { credit_cost: number },
  message: { isHost?: boolean }
): boolean {
  return row.credit_cost > 0 && !message.isHost;
}

export type ChargeOutcome =
  | { charged: true }
  // `balance` is what to quote back to the chatter. Null when there is no
  // membership at all, which is refused rather than allowed through free.
  | { charged: false; balance: number | null };

async function deps() {
  const [{ supabaseAdmin }, me] = await Promise.all([
    import("../supabase"),
    import("./me-command"),
  ]);
  return { supabaseAdmin, me };
}

// The membership whose purse a command is charged to, or null when there is
// none. The host resolves to null here and is never charged: they own the
// community rather than belonging to it, so there is no membership to charge.
export async function resolveMembershipId(
  message: BufferedMessage,
  communityId: string
): Promise<string | null> {
  const { supabaseAdmin, me } = await deps();

  const identity = await me.resolveMeIdentity(message, communityId);
  const channelId = await me.resolveChannelId(identity);
  if (!channelId) return null;

  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("id")
    .eq("channel_id", channelId)
    .eq("community_channel_id", communityId)
    .maybeSingle();
  if (error) {
    console.error(`membership lookup failed for ${channelId}:`, error.message);
    return null;
  }
  return data?.id ?? null;
}

// Charges one command. `sourceId` is the chat message, which is what makes a
// reprocessed batch bill once: a unique index on the ledger rejects the second
// line for the same message rather than trusting the caller to remember.
export async function chargeCommand(input: {
  membershipId: string;
  amount: number;
  sourceId: string;
}): Promise<ChargeOutcome> {
  const { supabaseAdmin } = await deps();

  const { data, error } = await supabaseAdmin.rpc("spend_credits", {
    p_membership_id: input.membershipId,
    p_amount: input.amount,
    p_kind: "command",
    p_source_id: input.sourceId,
  });

  if (error) {
    // A second charge for the same message trips the unique index. That is the
    // guard doing its job, not a failure: the chatter has already paid, so the
    // command proceeds rather than being refused for a debt they do not owe.
    if (error.code === "23505") return { charged: true };
    console.error(`credit charge failed for ${input.membershipId}:`, error.message);
    return { charged: false, balance: null };
  }

  const result = (data ?? {}) as { spent?: boolean; balance?: number };
  if (result.spent) return { charged: true };
  return { charged: false, balance: Number(result.balance ?? 0) };
}

// What the chatter is told when their purse is short. Kept here beside the
// charge so the price and the balance are always quoted from the same numbers.
export function insufficientReply(input: {
  mention: string;
  keyword: string;
  amount: number;
  balance: number | null;
}): string {
  const held = input.balance ?? 0;
  const cost = `${input.amount} credit${input.amount === 1 ? "" : "s"}`;
  const tail = `!${input.keyword} costs ${cost} — you have ${held}. Chat to earn more!`;
  // YouTube accepts 200 characters, and the chunker would split a longer reply
  // in half. The mention is the only part that can grow without bound, so it is
  // the part that gives way: the price and the balance always survive whole.
  const room = MAX_REPLY_CHARS - tail.length - 1;
  const who = input.mention.length > room
    ? input.mention.slice(0, Math.max(0, room))
    : input.mention;
  return who ? `${who} ${tail}` : tail;
}

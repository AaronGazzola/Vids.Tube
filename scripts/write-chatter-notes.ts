// Writes what the host needs to remember about everyone who spoke in one
// broadcast. The last step of the post-broadcast pass, and runnable by hand:
//
//   doppler run -- npx tsx scripts/write-chatter-notes.ts --stream <id> --apply
//
// Without --apply it says what it would write and writes nothing.
//
// Deliberately after the membership rebuild: a note is written against a
// chatter's totals as they now stand, and the snapshot it stores is what lets
// the next run skip them without paying for a model call.
import { createClient } from "@supabase/supabase-js";
import { printStepResult } from "../lib/step-result";
import type { Database } from "../supabase/types";
import {
  type ChatterIdentity,
  needsNotes,
  type NoteSnapshot,
  snapshotFromStored,
  writeChatterNotes,
} from "../worker/lib/chatter-notes";

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const APPLY = process.argv.includes("--apply");
const STREAM = process.argv.includes("--stream")
  ? process.argv[process.argv.indexOf("--stream") + 1]
  : null;

// One broadcast's chatters, each a model call. Forty is well above any real
// broadcast and stops a catch-up over the whole history turning into an
// unbounded run.
const MAX_CALLS = 40;

type Target = {
  membershipId: string;
  displayName: string;
  identity: ChatterIdentity;
  snapshot: NoteSnapshot;
  messagesThisBroadcast: number;
};

async function collectTargets(streamId: string): Promise<Target[]> {
  const { data: stream, error: streamError } = await admin
    .from("streams")
    .select("channel_id")
    .eq("id", streamId)
    .maybeSingle();
  if (streamError) throw new Error(streamError.message);
  if (!stream) throw new Error(`no such broadcast: ${streamId}`);
  const community = stream.channel_id;

  const { data: messages, error: messageError } = await admin
    .from("chat_messages")
    .select("user_id, external_author_id, origin, author_name")
    .eq("stream_id", streamId)
    .is("hidden_at", null);
  if (messageError) throw new Error(messageError.message);

  // Count per identity key, so the cap keeps the people most present in the
  // broadcast rather than whoever the database returned first.
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const m of messages ?? []) {
    if (m.origin === "bot") continue;
    const key =
      m.origin === "youtube"
        ? m.external_author_id
          ? `youtube:${m.external_author_id}`
          : null
        : m.user_id
          ? String(m.user_id)
          : null;
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (m.author_name && !names.has(key)) names.set(key, m.author_name);
  }
  if (!counts.size) return [];

  const { data: memberships, error: membershipError } = await admin
    .from("memberships")
    .select(
      "id, message_count, streams_attended, channel_id, channels!memberships_channel_id_fkey(id, name, handle, youtube_channel_id, owner_user_id, is_software)"
    )
    .eq("community_channel_id", community);
  if (membershipError) throw new Error(membershipError.message);

  const targets: Target[] = [];
  for (const m of memberships ?? []) {
    const channel = m.channels as unknown as {
      name: string | null;
      handle: string | null;
      youtube_channel_id: string | null;
      owner_user_id: string | null;
      is_software: boolean | null;
    } | null;
    if (!channel || channel.is_software) continue;

    // The host holds no membership in their own community, so no exclusion is
    // needed here beyond the community scope itself.
    const keys: string[] = [];
    if (channel.owner_user_id) keys.push(String(channel.owner_user_id));
    if (channel.youtube_channel_id) {
      keys.push(`youtube:${channel.youtube_channel_id}`);
    }
    const spoken = keys.reduce((a, k) => a + (counts.get(k) ?? 0), 0);
    if (!spoken) continue;

    targets.push({
      membershipId: m.id,
      displayName: channel.name ?? channel.handle ?? names.get(keys[0]) ?? "a chatter",
      identity: {
        userId: channel.owner_user_id,
        youtubeChannelId: channel.youtube_channel_id,
      },
      snapshot: {
        messageCount: m.message_count,
        streamsAttended: m.streams_attended,
      },
      messagesThisBroadcast: spoken,
    });
  }

  targets.sort((a, b) => b.messagesThisBroadcast - a.messagesThisBroadcast);
  return targets;
}

async function main() {
  if (!STREAM) {
    console.error("usage: write-chatter-notes.ts --stream <id> [--apply]");
    process.exit(1);
  }

  const targets = await collectTargets(STREAM);
  console.log(`${targets.length} chatter(s) spoke in ${STREAM.slice(0, 8)}`);

  // Skipping is decided before the cap is applied, so a broadcast full of
  // already-written regulars does not push a new arrival past the limit.
  const stored = new Map<string, NoteSnapshot | null>();
  if (targets.length) {
    const { data: rows } = await admin
      .from("chatter_notes")
      .select("membership_id, snapshot")
      .in(
        "membership_id",
        targets.map((t) => t.membershipId)
      );
    for (const r of rows ?? []) {
      stored.set(r.membership_id, snapshotFromStored(r.snapshot));
    }
  }

  const owed = targets.filter((t) =>
    needsNotes(t.snapshot, stored.get(t.membershipId) ?? null)
  );
  let skipped = targets.length - owed.length;
  const batch = owed.slice(0, MAX_CALLS);
  const capped = owed.length - batch.length;
  if (capped > 0) {
    console.log(`capped at ${MAX_CALLS}; ${capped} chatter(s) left for a later run`);
  }

  const nowMs = Date.now();
  let written = 0;
  let failed = 0;

  for (const t of batch) {
    try {
      const outcome = await writeChatterNotes({
        membershipId: t.membershipId,
        streamId: STREAM,
        identity: t.identity,
        displayName: t.displayName,
        snapshot: t.snapshot,
        nowMs,
        apply: APPLY,
      });
      if (outcome === "written") {
        written += 1;
        console.log(`  ${APPLY ? "wrote" : "would write"} ${t.displayName}`);
      } else {
        skipped += 1;
        console.log(`  skipped ${t.displayName} (${outcome})`);
      }
    } catch (e) {
      failed += 1;
      console.error(`  failed ${t.displayName}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\n${written} written, ${skipped} skipped, ${capped} capped, ${failed} failed`
  );
  printStepResult({ written, skipped, capped, failed });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// What the host needs to remember about one chatter, written after a broadcast
// rather than while one runs.
//
// A card in the pop-out roster reads these. Generating them on arrival would put
// a model call on the path of somebody saying hello, so nothing here is reachable
// from a live request: the post-broadcast pass is the only caller.
//
// The pure halves — pruning, the regeneration test, parsing — are kept free of
// the database and of the model so they can be tested without either.

// Imported lazily so the pure helpers stay testable without worker env
// configured, matching how the !me command does it.
async function deps() {
  const [{ supabaseAdmin }, { runClaude }] = await Promise.all([
    import("../supabase"),
    import("./claude"),
  ]);
  return { supabaseAdmin, runClaude };
}

export type NoteKind = "standing" | "checkin";

export type Note = {
  text: string;
  kind: NoteKind;
  raisedAt: string;
};

export type NoteSnapshot = {
  messageCount: number;
  streamsAttended: number;
};

// A check-in is a question worth asking next time. Six weeks on it is no longer
// a kindness, so it goes rather than being asked about late.
export const CHECKIN_MAX_AGE_DAYS = 60;
export const MAX_CHECKINS = 3;
export const MAX_NOTES = 8;
// The chatter's own recent messages in the broadcast being settled.
export const MAX_MESSAGES = 20;
// Transcript either side of each message, so a reply reads as part of a
// conversation rather than as an isolated line.
export const CONTEXT_WINDOW_S = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function raisedMs(note: Note): number {
  const t = Date.parse(note.raisedAt);
  return Number.isFinite(t) ? t : 0;
}

// Newest first, so every cap below keeps what is most recent.
function byRecency(a: Note, b: Note): number {
  return raisedMs(b) - raisedMs(a);
}

export function pruneNotes(notes: Note[], nowMs: number): Note[] {
  const fresh = notes.filter((n) => {
    if (n.kind !== "checkin") return true;
    return nowMs - raisedMs(n) <= CHECKIN_MAX_AGE_DAYS * DAY_MS;
  });

  const checkins = fresh.filter((n) => n.kind === "checkin").sort(byRecency);
  const standing = fresh.filter((n) => n.kind === "standing").sort(byRecency);

  const kept = [...checkins.slice(0, MAX_CHECKINS), ...standing];
  return kept.sort(byRecency).slice(0, MAX_NOTES);
}

// A chatter who has said nothing since their notes were written costs nothing to
// skip, and a model call to confirm what is already stored. The test is the one
// the cached !me profile already applies: totals moved, or they did not.
export function needsNotes(
  current: NoteSnapshot,
  stored: Partial<NoteSnapshot> | null
): boolean {
  if (!stored) return true;
  return (
    current.messageCount !== (stored.messageCount ?? 0) ||
    current.streamsAttended !== (stored.streamsAttended ?? 0)
  );
}

export type NoteInputs = {
  displayName: string;
  // One entry per message: what they said, the day they said it, and what was
  // being said on the broadcast around it. The date is supplied rather than
  // left to the model, which otherwise dates everything the day it is asked —
  // and a catch-up over old broadcasts would then stamp a year-old check-in as
  // today's and never expire it.
  exchanges: { said: string; saidOn: string; context: string }[];
};

export function buildNotesPrompt(
  inputs: NoteInputs,
  existing: Note[]
): string {
  const existingBlock = existing.length
    ? existing
        .map((n) => `- [${n.kind}] (${n.raisedAt}) ${n.text}`)
        .join("\n")
    : "- (none yet)";

  const exchangeBlock = inputs.exchanges
    .map(
      (e, i) =>
        `${i + 1}. [${e.saidOn}] THEY SAID: ${e.said}\n   ON STREAM AROUND THEN: ${
          e.context || "(nothing transcribed)"
        }`
    )
    .join("\n");

  return [
    "You are helping a livestreamer remember one of their regular chatters, so",
    "that next time that person appears the streamer can greet them properly and",
    "pick up the last conversation.",
    "",
    `CHATTER: ${inputs.displayName}`,
    "",
    "WHAT IS ALREADY REMEMBERED ABOUT THEM:",
    existingBlock,
    "",
    "WHAT THEY SAID IN THE BROADCAST THAT JUST FINISHED:",
    exchangeBlock,
    "",
    "Write the points worth remembering. Two kinds:",
    "",
    "STANDING — durable facts about the person: what they study, what work they",
    "do, where they are, a project or hobby they keep returning to.",
    "",
    "CHECKIN — something with a shelf life that invites a question next time:",
    "an illness, an exam, a trip, a birthday, an interview, a decision they were",
    "weighing. These are the valuable ones. \"How did the exam go?\" is the point",
    "of this whole exercise.",
    "",
    "Rules:",
    "- Only write what the messages or the surrounding transcript actually",
    "  support. Never guess, never infer a job or a country from a name or an",
    "  accent, never invent a detail to fill a line.",
    "- Return the COMPLETE list: every point already remembered that is still",
    "  worth keeping, plus anything new. Update a point rather than writing a",
    "  second one saying the same thing. Anything you leave out is forgotten.",
    "- Drop anything that is only a statistic. The streamer can already see how",
    "  many messages they have sent and what level they are.",
    "- Write it as a thing to say to them, not as a dossier entry. Short.",
    "- Nothing sensitive: no addresses, no contact details, no health detail",
    "  beyond what they volunteered in passing.",
    "- If nothing is worth remembering and nothing was remembered before, return",
    "  no lines at all. An empty answer is correct and is better than a padded",
    "  one.",
    "",
    "Answer as lines in exactly this format and nothing else:",
    "STANDING|YYYY-MM-DD|the point",
    "CHECKIN|YYYY-MM-DD|the point",
    "",
    "The date is the one in square brackets on the message the point came from.",
    "Copy it exactly. Never use today's date, and never invent one. For a point",
    "carried forward unchanged, keep the date it already had.",
  ].join("\n");
}

export function parseNotes(response: string): Note[] {
  const notes: Note[] = [];
  for (const raw of response.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < 3) continue;
    const kindWord = parts[0].trim().toUpperCase();
    const kind: NoteKind | null =
      kindWord === "STANDING"
        ? "standing"
        : kindWord === "CHECKIN"
          ? "checkin"
          : null;
    if (!kind) continue;
    const raisedAt = parts[1].trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raisedAt)) continue;
    const text = parts.slice(2).join("|").trim();
    if (!text) continue;
    notes.push({ text, kind, raisedAt });
  }
  return notes;
}

// Stored shape is snake_case, matching the column comment and every other jsonb
// payload in this database.
type StoredNote = { text: string; kind: string; raised_at: string };

export function toStored(notes: Note[]): StoredNote[] {
  return notes.map((n) => ({
    text: n.text,
    kind: n.kind,
    raised_at: n.raisedAt,
  }));
}

export function fromStored(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const notes: Note[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<StoredNote>;
    if (typeof r.text !== "string" || !r.text.trim()) continue;
    if (r.kind !== "standing" && r.kind !== "checkin") continue;
    if (typeof r.raised_at !== "string") continue;
    notes.push({ text: r.text, kind: r.kind, raisedAt: r.raised_at });
  }
  return notes;
}

export function snapshotFromStored(value: unknown): NoteSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const messageCount = v.message_count;
  const streamsAttended = v.streams_attended;
  if (typeof messageCount !== "number" || typeof streamsAttended !== "number") {
    return null;
  }
  return { messageCount, streamsAttended };
}

export function snapshotToStored(s: NoteSnapshot) {
  return { message_count: s.messageCount, streams_attended: s.streamsAttended };
}

// The identity keys a membership is derived from, the same pair the membership
// recompute uses. A chatter is one or both of these and never anything else.
export type ChatterIdentity = {
  userId: string | null;
  youtubeChannelId: string | null;
};

export async function gatherNoteInputs(
  streamId: string,
  identity: ChatterIdentity,
  displayName: string
): Promise<NoteInputs> {
  const { supabaseAdmin } = await deps();

  const filters: string[] = [];
  if (identity.userId) filters.push(`user_id.eq.${identity.userId}`);
  if (identity.youtubeChannelId) {
    filters.push(
      `and(origin.eq.youtube,external_author_id.eq.${identity.youtubeChannelId})`
    );
  }
  if (!filters.length) return { displayName, exchanges: [] };

  const { data: messages } = await supabaseAdmin
    .from("chat_messages")
    .select("body, created_at")
    .eq("stream_id", streamId)
    .or(filters.join(","))
    .is("hidden_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_MESSAGES);

  if (!messages?.length) return { displayName, exchanges: [] };

  // The transcript is offset from the moment the broadcast went public, falling
  // back to the encoder connecting, which is the same anchor chat replay uses.
  const { data: stream } = await supabaseAdmin
    .from("streams")
    .select("live_at, started_at")
    .eq("id", streamId)
    .maybeSingle();
  const anchorRaw = stream?.live_at ?? stream?.started_at ?? null;
  const anchorMs = anchorRaw ? Date.parse(anchorRaw) : NaN;

  const { data: segments } = Number.isFinite(anchorMs)
    ? await supabaseAdmin
        .from("transcript_segments")
        .select("text, start_s, end_s")
        .eq("stream_id", streamId)
        .order("start_s", { ascending: true })
    : { data: null };

  const exchanges = messages
    .slice()
    .reverse()
    .map((m) => {
      let context = "";
      if (segments?.length && Number.isFinite(anchorMs)) {
        const at = (Date.parse(m.created_at) - anchorMs) / 1000;
        context = segments
          .filter(
            (s) =>
              s.end_s >= at - CONTEXT_WINDOW_S &&
              s.start_s <= at + CONTEXT_WINDOW_S
          )
          .map((s) => s.text.trim())
          .join(" ")
          .trim();
      }
      return {
        said: m.body.replace(/\s+/g, " ").trim(),
        saidOn: m.created_at.slice(0, 10),
        context,
      };
    })
    .filter((e) => e.said.length > 0);

  return { displayName, exchanges };
}

export type WriteOutcome = "written" | "skipped" | "nothing-said";

// Writes one chatter's notes. Returns what it did so the caller can report
// counts rather than guess at them.
export async function writeChatterNotes(args: {
  membershipId: string;
  streamId: string;
  identity: ChatterIdentity;
  displayName: string;
  snapshot: NoteSnapshot;
  nowMs: number;
  apply: boolean;
}): Promise<WriteOutcome> {
  const { supabaseAdmin, runClaude } = await deps();

  const { data: existingRow } = await supabaseAdmin
    .from("chatter_notes")
    .select("notes, snapshot")
    .eq("membership_id", args.membershipId)
    .maybeSingle();

  const stored = snapshotFromStored(existingRow?.snapshot);
  if (!needsNotes(args.snapshot, stored)) return "skipped";

  const existing = fromStored(existingRow?.notes);
  const inputs = await gatherNoteInputs(
    args.streamId,
    args.identity,
    args.displayName
  );
  if (!inputs.exchanges.length) return "nothing-said";

  const response = await runClaude(buildNotesPrompt(inputs, existing));
  const returned = parseNotes(response);

  // The model is asked for the complete list, so what it returns replaces what
  // was stored. An empty answer from a chatter who was already remembered is
  // treated as "nothing to add" rather than as "forget them" — a parse that
  // went wrong must not erase a year of notes. The snapshot is still advanced,
  // so the same broadcast is not paid for twice.
  const kept = pruneNotes(returned.length ? returned : existing, args.nowMs);

  if (!args.apply) return "written";

  const { error } = await supabaseAdmin.from("chatter_notes").upsert({
    membership_id: args.membershipId,
    notes: toStored(kept) as never,
    snapshot: snapshotToStored(args.snapshot) as never,
    source_stream_id: args.streamId,
    generated_at: new Date(args.nowMs).toISOString(),
  });
  if (error) {
    console.error(`chatter notes write failed: ${error.message}`);
    throw new Error(error.message);
  }
  return "written";
}

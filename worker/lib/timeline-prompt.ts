import type {
  ActivityBucket,
  ChatLine,
  TranscriptLine,
} from "../../lib/timeline.types";
import { formatActivitySeries } from "../../lib/timeline-activity";

export const MOMENT_KINDS = [
  "command",
  "joke",
  "chat_spike",
  "featured_message",
  "member_event",
  "fail",
  "reaction",
] as const;

export type TimelinePromptInput = {
  title: string;
  durationS: number;
  transcript: TranscriptLine[];
  chatLines: ChatLine[];
  activity: ActivityBucket[];
};

const RUBRIC = `You annotate a finished live stream so its best parts can be found and cut
into short videos later, without scrubbing the source. You are given the stream's
transcript as timed lines, its chat from both origins, and a measured per-minute chat
activity series.

Produce three things.

THREADS are the subjects the stream covers. A thread has no time of its own: it holds
one or more SPANS, and each span is one appearance of that subject in the stream.

The single most important rule: a subject the stream comes back to is ONE thread with
SEVERAL spans, never several threads. If account linking is designed at 26 minutes,
tested at 56 minutes, and tested again at 95 minutes, that is one thread titled
"account linking" holding three spans — not three separate threads. The same goes for a
running joke, a bug chased across the stream, or a feature returned to after a
digression. Look across the WHOLE stream for each subject before deciding it is done.

Threads may overlap and nest freely. A long "debugging the deploy" thread can run for
40 minutes while a 6-minute "argument about mustaches" thread runs inside it, and both
are real. Do not force a flat partition.

Give each thread a title, a one-or-two-sentence summary, tags, and scores. Give each
span a short label saying which part of the thread it is — "first mention", "the
denial", "tested live" — not a restatement of the subject. Every span carries its own
scores, because one appearance of a subject can be much better material than another.

MOMENTS are single events worth cutting on their own: a chat command, a joke that
landed, a spike in chat rate, a highlighted message, a member event, a mistake or fail,
a strong reaction.

A moment is a WINDOW, not a point. Its start and end must bound a clip that stands on
its own to someone who was not watching — include the setup before the thing and the
reaction after it. "peak_s" is the instant the thing itself happens. A moment whose end
equals its start is invalid and will be rejected: a punchline with no setup is not a
clip. Give each a "kind", preferring an existing kind from this list over inventing a
synonym: ${MOMENT_KINDS.join(", ")}.

A moment MAY name the thread it belongs to, by that thread's exact title — the AI
tracing the mustache commenter belongs to the mustache thread. Use null when the moment
belongs to no particular subject, as a chat spike often does.

CHAPTERS are the opposite of threads: exactly one flat, non-overlapping, strictly
increasing spine over the whole stream, the way a viewer would navigate it. The first
chapter starts at 0. Each chapter runs until the next one begins, so give only a start
time and a title. Aim for chapters a viewer would actually use, not one per topic shift.

TAGS name the SUBJECT, and they exist to find the same subject in OTHER streams. Use
words that would still mean something on a different broadcast: the project, the
feature, the tool, the recurring bit. Do not tag a quality — the scores already measure
how funny or interesting something is. Do not tag an event type — a moment's "kind"
already carries that. Prefer a handful of durable tags over many specific ones.

SCORING. Every thread, every span and every moment carries three scores, each an integer
0-100:
- humour: how funny it is
- interest: how interesting it is to someone who was not there
- engagement: how much the audience reacted

These scores are ABSOLUTE, not relative to this stream. An 80 must mean the same thing
on a quiet stream as on a lively one, because scores from different streams are ranked
against each other later. Do not normalise or spread scores to fill the range: a stream
where nothing remarkable happens should score low throughout.

Score engagement from the supplied chat activity series and the chat itself, not from how
lively the transcript reads. A span over a stretch with no chat activity does not get
a high engagement score no matter how good the material is.

TIMESTAMPS. Every timestamp is in seconds from the start of the stream, and must fall
within the stream duration given below. Use the timestamps on the transcript lines; do
not invent precision the transcript does not have.`;

function formatTranscript(lines: TranscriptLine[]): string {
  if (lines.length === 0) {
    return "(no transcript)";
  }
  return lines
    .map((line) => `[${Math.round(line.atS)}] ${line.text}`)
    .join("\n");
}

function formatChat(lines: ChatLine[]): string {
  if (lines.length === 0) {
    return "(no chat)";
  }
  return lines
    .map((line) => `[${Math.round(line.atS)}] ${line.author}: ${line.body}`)
    .join("\n");
}

export function buildTimelinePrompt(input: TimelinePromptInput): string {
  return `${RUBRIC}

## Stream
Title: ${input.title}
Duration: ${Math.round(input.durationS)} seconds

## Transcript (one line per segment, [seconds] prefix)
${formatTranscript(input.transcript)}

## Chat ([seconds] prefix)
${formatChat(input.chatLines)}

## Measured chat activity
${formatActivitySeries(input.activity)}

## Output
Return ONLY a JSON object, no prose, of this exact shape:
{
  "threads": [ { "title": "<short>", "summary": "<short>", "tags": ["..."], "scores": { "humour": 0, "interest": 0, "engagement": 0 },
                 "spans": [ { "start_s": 0, "end_s": 0, "label": "<short>", "scores": { "humour": 0, "interest": 0, "engagement": 0 } } ] } ],
  "moments":  [ { "start_s": 0, "peak_s": 0, "end_s": 0, "kind": "<kind>", "label": "<short>", "summary": "<short>", "tags": ["..."], "scores": { "humour": 0, "interest": 0, "engagement": 0 }, "thread": "<thread title or null>" } ],
  "chapters": [ { "start_s": 0, "title": "<short>" } ]
}
Include all three keys and no others. Every thread must hold at least one span. Every
moment must have "end_s" strictly greater than "start_s", and "peak_s" between the two.
All three score criteria are required on every thread, span and moment.`;
}

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

const RUBRIC = `You annotate a finished live stream so its best parts can be found later
without scrubbing the video. You are given the stream's transcript as timed lines, its
chat from both origins, and a measured per-minute chat activity series.

Produce three things.

SECTIONS are spans of stream time about one thing. Sections MAY overlap and MAY nest,
and you must not force them into a single flat partition: "debugging the deploy" can run
for 40 minutes while "argument about mustaches" runs for 6 minutes inside it, and both
are real sections. Open a section where the content starts and close it where that
content stops, even if a newer section opened in between. Give each a short label, a
one-or-two-sentence summary, and tags describing topic, activity, and who is involved.

MOMENTS are points where something specific happened: a chat command, a joke that
landed, a spike in chat rate, a highlighted message, a member event, a mistake or fail,
a strong reaction. A moment's end may equal its start. Give each a "kind", preferring an
existing kind from this list over inventing a synonym: ${MOMENT_KINDS.join(", ")}.

CHAPTERS are the opposite of sections: exactly one flat, non-overlapping, strictly
increasing spine over the whole stream, the way a viewer would navigate it. The first
chapter starts at 0. Each chapter runs until the next one begins, so give only a start
time and a title. Aim for chapters a viewer would actually use, not one per topic shift.

SCORING. Every section and every moment carries three scores, each an integer 0-100:
- humour: how funny it is
- interest: how interesting it is to someone who was not there
- engagement: how much the audience reacted

These scores are ABSOLUTE, not relative to this stream. An 80 must mean the same thing
on a quiet stream as on a lively one, because scores from different streams are ranked
against each other later. Do not normalise or spread scores to fill the range: a stream
where nothing remarkable happens should score low throughout.

Score engagement from the supplied chat activity series and the chat itself, not from how
lively the transcript reads. A section over a stretch with no chat activity does not get
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
  "sections": [ { "start_s": 0, "end_s": 0, "label": "<short>", "summary": "<short>", "tags": ["..."], "scores": { "humour": 0, "interest": 0, "engagement": 0 } } ],
  "moments":  [ { "start_s": 0, "end_s": 0, "kind": "<kind>", "label": "<short>", "summary": "<short>", "tags": ["..."], "scores": { "humour": 0, "interest": 0, "engagement": 0 } } ],
  "chapters": [ { "start_s": 0, "title": "<short>" } ]
}
Include all three keys and no others. A section whose end is genuinely unknown may use
null for "end_s"; a moment must have a numeric "end_s", which may equal "start_s". All
three score criteria are required on every section and moment.`;
}

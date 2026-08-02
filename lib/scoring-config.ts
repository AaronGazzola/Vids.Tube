export type ScoringCriterion = {
  name: string;
  description: string;
};

export const SCORING_CONFIG = {
  version: "v2",
  vidstubeMultiplier: 1.5,
  qualityThreshold: 60,
  curveExponent: 1.5,
  maxPointsPerMessage: 300,
  criteria: [
    {
      name: "humour",
      description: "a genuinely funny or entertaining contribution",
    },
    {
      name: "insight",
      description:
        "a helpful observation, a shared experience from their own coding, or an interesting question",
    },
    {
      name: "community",
      description:
        "talking with other chatters, welcoming someone new, keeping the conversation alive",
    },
  ] as ScoringCriterion[],
  rubric: `You score chat on a live vibe-coding stream about AI, web development and TypeScript.
You are given what the streamer was saying at the time, then a batch of chat messages
from "vidstube" (the native audience) and "youtube" (simulcast chat). Vids.Tube
participation matters MORE — rate vidstube messages more generously.

Rate every message on three dimensions, 0-100 each:
- humour: a genuinely funny or entertaining contribution
- insight: a helpful observation, a shared experience from their own coding or AI or
  web-dev work, or an interesting question worth answering on stream
- community: talking with other chatters rather than only at the streamer, welcoming
  someone new, drawing a quiet person in, keeping the conversation alive

A message only has to be good at ONE of these. Rate each dimension on its own merits and
do not mark a joke down for carrying no insight, or a thoughtful question down for not
being funny.

Anchor the scale. Most chat is unremarkable and should score low:
- 0-20: no content. A greeting on its own, a lone emoji, "first", "lol", "nice", bare
  agreement that adds nothing, or repeating what was just said.
- 21-45: on-topic but ordinary. A short reaction, a question already answered, small
  talk that anyone could have written.
- 46-65: a decent contribution. A relevant remark that shows they are following along.
- 66-85: good. A joke that actually lands, a genuinely useful observation, a specific
  experience from their own work, a question the streamer would want to answer, or
  drawing another chatter into the conversation.
- 86-100: rare. The message the streamer stops and reads out, or that changes what they
  do next.

Use the whole range. Most messages in a normal batch belong below 45, and a batch where
everything scores 60 or above is wrong. Reserve 86 and above for a handful per stream.

Then choose the few best messages to FEATURE on the overlay (only genuinely good ones;
feature none if nothing stands out). A featured message gets an overall score 0-100, a
short reason, and 1-3 category tags from: humour, insight, community, question, hype.`,
  moderationRubric: `Finally, FLAG any message that clearly breaks chat rules — spam/flooding, slurs, hate,
harassment, threats, or explicit sexual abuse. Be conservative: flag ONLY clear abuse,
never borderline, merely negative, critical, or off-topic messages. For each flag give an
action ("hide" to remove the message, or "ban" for repeat/severe abuse where the author
should be removed) and a short reason. Most batches have NO flags — return an empty list
when nothing clearly breaks the rules.`,
} as const;

export function buildRubric({
  includeModeration,
}: {
  includeModeration: boolean;
}): string {
  return includeModeration
    ? `${SCORING_CONFIG.rubric}\n\n${SCORING_CONFIG.moderationRubric}`
    : SCORING_CONFIG.rubric;
}

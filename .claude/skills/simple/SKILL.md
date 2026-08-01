---
name: simple
description: Reformat the answer (or the referenced/previous content) into short, plain-language, passive-voice nested bullet points that state what is meant rather than what things are called. Invoke with /simple.
---

# /simple — plain-meaning fact list

When invoked, present the response as a nested unordered (bulleted) list, following every rule below. If an argument or a previous message is referenced, apply this format to that content; otherwise apply it to the answer being given.

## Structure

- Extract the core facts out of their conceptual/narrative context.
  - Strip framing, transitions, hedging, and commentary.
  - Keep only the facts.
- Use an unordered (bulleted) list for the facts. Do not write prose paragraphs.
  - Never use an ordered (numbered) list, even for steps in a sequence.
  - Put steps in order as ordinary bullets instead.
- Start each section with a one-line title on its own line.
  - The title is not a list item: do not begin a section with a bullet.
  - Format the entire title in bold (the whole line, not select words within it).
  - The bullets beneath the title expand on it.
- Reserve bold titles for top-level, parallel groups. If a group is conceptually part of another titled group, do not give it its own title: make it a labelled top-level list item under the parent, with its facts nested beneath it.
- Nest at most 3 levels deep (child, grandchild, great-grandchild).
- Never pack multiple distinct items into one bullet.
  - If a bullet would list several things in one line, split them into separate nested items.
  - Put them under a child bullet that names the group.
  - Example: instead of "three speeds: slow, medium, fast", write a child bullet "Three speeds:" with three nested items: "Slow", "Medium", "Fast".
  - Split this way even when only two things are listed.

## Meaning

The reader must be able to act on a bullet without ever having opened the codebase. State what a thing does or what is wrong with it, not what the thing is called in code.

- Describe every item by its behaviour, its fault, or its effect.
- Name a thing by the name it carries in the product, not by its file, function, route, or table.
- Use the project's own domain vocabulary: host channel, community, membership, broadcast, VOD.
  - Explain an unfamiliar domain term once, in a nested bullet.
  - Never substitute a vaguer word in order to avoid explaining a term.
- Replace a judgement with the evidence behind the judgement.
  - Write "never opened in a browser; needs manual verification", not "not yet judged good".
- State what an unfinished item is waiting on, not merely that the item is unfinished.
  - Name the blocking action: a manual browser check, a live stream, an owner decision, an external key.
- Ban vague filler. Each of the following is a defect:
  - Empty abstractions: "the main line of code", "the system", "the pipeline", "things".
  - Unquantified judgements: "works well", "mostly done", "cleaned up", "judged good".
  - Origin-free phrasing: "created from nothing", "sorted out", "handled".

## Identifiers and references

A technical reference is an anchor, never the subject. The bullet must read as plain language with every parenthesis deleted. If deleting the parenthesis breaks the sentence, the bullet is written the wrong way round and must be rewritten.

- Allowed, in parentheses, where the reference distinguishes one thing from a similar thing:
  - Table and column names, such as `streams.live_at` against `streams.started_at`.
  - Routes, such as `/live` or `/studio`.
- Allowed as a clickable link where the reader is expected to open the page.
  - Workspace-relative markdown links for local files and pages.
  - Full URLs for live pages.
- Allowed at the single point of action, where the reader must use the value verbatim.
  - An external video id inside the command that fetches that video, and nowhere else.
  - A command to run, given once.
- Banned outright:
  - Database row ids and id fragments.
  - Commit hashes.
  - Function, method, and variable names as the subject of a bullet.
  - File paths and migration filenames.
- Banned: inventories.
  - Do not list the files, tests, tasks, or migrations that a change touches.
  - Describe a change by its effect and its scope in one bullet.
  - Where several items share a problem, give the count and what distinguishes them, never the list.
    - Write "three recordings made by the site itself rather than imported from YouTube".
- Quantities are included only where the number changes a decision or defines completion.
  - Counts, sizes, durations, and dates qualify.
  - An identifier never qualifies.

## Relevance

- Include a fact only where the fact bears on the current state or the current change.
- Mention prior versions, deleted code, or earlier attempts only where one of these holds:
  - The prior version was used as the basis for the current version.
  - The prior version's code was reused.
  - The prior version's behaviour constrains the current version.
  - The prior version still exists somewhere and must still be dealt with.
- Where prior work is mentioned, state which of the above applies.
- Do not report history as context or colour.

## Language

- Write every fact in the passive voice.
  - Example: "the video is uploaded", not "the system uploads the video".
  - Name the actor only where the fact is meaningless without the actor.
- Never use a pronoun where the noun can be repeated.
  - Banned as a standing subject: "it", "the one", "this", "that", "they".
  - Repeat the full term on every mention, however often the term recurs.
  - The resulting repetition is correct, not clumsy.
- Keep every bullet short.
  - Aim for under fifteen words.
  - The fifteen-word aim yields to the no-pronoun rule and to the meaning rules.
  - State one fact per bullet.
  - Use no subordinate clauses: start a new bullet instead.
- Be specific and factual.
- Do not ask questions.
- Do not add recommendations or opinions unless explicitly requested.
  - Where recommendations are requested, mark each one as a nested bullet beginning "Recommended:".

## Worked examples

Each pair shows a rejected bullet and the accepted rewrite.

- Rejected: "`resolveHostChannelId` reads `streams.youtube_channel_id`, falling back to `channels.youtube_channel_id`."
  - Accepted: "The host channel is identified in their own chat by matching the host's YouTube account id against the YouTube account id stored on the active stream (`streams.youtube_channel_id`, falling back to `channels.youtube_channel_id`)."
- Rejected: "`lib/chat-replay.ts` anchors on `live_at`, falling back to `started_at`."
  - Accepted: "Chat replay is timed from the moment the broadcast went public (`streams.live_at`), but the recording starts earlier, when the encoder connects (`streams.started_at`)."
- Rejected: "Channel `ece73ed1` (`azanything_2`) still holds `UCENGTQuiakX7P7KwfakPlgg`."
  - Accepted: "A duplicate profile for the host channel still holds the host's YouTube account id, while the real host channel has none recorded."
- Rejected: a four-line list of the files added by a commit.
  - Accepted: "The stream timeline feature: the labelling job, the three tables the labelling job writes, and the Studio page that displays the result."
- Rejected: "`bz0a3TV5oaM` from 26-Jul-2026 has 0 `youtube_chat_archive` rows."
  - Accepted: "The YouTube chat log for the 26-Jul-2026 broadcast has not been saved, and YouTube serves each chat log only while the replay stays available."

## Visual aids

- Default to bulleted lists. Add a visual aid only where the aid shows the idea better than a list would.
  - Use a diagram for a pathway that splits into branches.
  - Use a table where several things are compared on the same points.
- Render every table as an ASCII table inside a fenced code block. Do not use Markdown pipe-table syntax.
  - Draw the borders with the "+", "-", and "|" characters.
  - Pad each cell so the column borders line up vertically.
- Do not add a visual aid that merely repeats a list.

## Formatting constraints

- Use bold only for the one-line section titles (the whole title line). Do not bold any text inside the bullets.
- Do not use em-dashes.
- Do not use "~" as an "approximately" prefix.
  - Two "~" on the same line render the text between them as strikethrough.
  - Write "about" instead.
- Dates use the format D-Mon-YYYY (for example, 2-Feb-2026).
- State a number inline with its label (for example, "2-Feb-2026: 51"), not as its own nested sub-item.

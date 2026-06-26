---
name: plain
description: Reformat the answer (or the referenced/previous content) into concise, factual, impersonal nested bullet points. Invoke with /plain.
---

# /plain — structured fact list

When invoked, present the response as a structured unordered (bulleted) list, following every rule below. If an argument or a previous message is referenced, apply this format to that content; otherwise apply it to the answer being given.

## Rules

- Extract the core facts out of their conceptual/narrative context.
  - Strip framing, transitions, hedging, and commentary.
  - Keep only the facts.
- Default to an unordered (bulleted) list for the facts. Do not write prose paragraphs.
  - Use an ordered (numbered) list instead when the facts are a sequence whose order matters: a linear step-by-step process, a ranking, or a chronology.
  - Keep bullets when order does not matter.
- Start each section, paragraph, or thought with a one-line title, description, or question on its own line.
  - The title is not a list item: do not begin a section with a bullet.
  - Format the entire title in bold (the whole line, not select words within it).
  - The bullets beneath the title expand on it.
  - The title names what the group is (for example "Purpose", "Two-pass execution", or a question being answered).
- Reserve bold titles for top-level, parallel groups. If a group is conceptually part of another titled group, do not give it its own title: make it a labelled top-level list item under the parent, with its facts nested beneath it.
- Under each title, use bullets for the facts; nest at most 2 levels deep (child → grandchild).
- Never pack multiple distinct items into one bullet.
  - If a bullet would list several things in one line, split them into separate nested items.
  - Put them under a child bullet that describes the group.
  - Example: instead of "email, phone, mailing address", write a child bullet "Contact methods:" with three nested items: "Email", "Phone", "Mailing address".
- Use concise, plain language.
- Be specific, factual, and impersonal.
- Do not ask questions.
- Do not add recommendations or opinions unless explicitly requested.

## Visual aids

- Default to text (bulleted or ordered lists). Add a visual aid only when it represents the idea more effectively than a list would.
  - Use a flow chart or diagram for a forking or branching pathway, where the structure itself carries meaning.
  - Use an ordered list, not a flow chart, for a linear step-by-step process.
  - Use a table when comparing several items across the same dimensions.
- Do not add a visual aid that merely restates a list.

## Formatting constraints

- Use bold only for the one-line section titles (the whole title line). Do not bold any text inside the bullets.
- Put code identifiers in backticks so they render as code: file paths, file names, function names, variable names, and repository names (for example, `strategy.py`, `decide_and_size`, `edge_threshold`, `ptl-trade`).
- Do not use em-dashes.
- Do not use "~" as an "approximately" prefix.
  - Two "~" on the same line render the text between them as strikethrough (Slack/Markdown).
  - Write "about" or "approximately" instead.
- Dates use the format D-Mon-YYYY (for example, 2-Feb-2026).
- State a number inline with its label (for example, "2-Feb-2026: 51"), not as its own nested sub-item.

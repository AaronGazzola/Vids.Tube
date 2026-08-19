---
name: short
description: Answer with only what is needed to move forward: the present situation, what happens next, the decisions being waited on, and an optional flags list of set-aside items. Uses the /simple bullet format. Invoke with /short.
---

# /short — situation, next steps, decisions

When invoked, give the shortest report that lets the user act. If an argument or a previous message is referenced, apply this to that content; otherwise apply it to the answer being given.

## What the report is for

The user reads this to answer one question: what is needed to keep going?

- The present situation, in enough detail for the rest of the report to make sense.
- What happens next.
- The decisions being waited on, asked as questions.
- Flags: items judged not important enough for the sections above, listed anyway so the judgement can be overruled.

Every bullet earns its place by changing what the user does next, decides next, or chooses to look at next. A bullet that only proves the work was done is deleted.

## What is left out

Each of the following is cut, however interesting:

- How a thing works, why a thing works, and the design behind it.
  - Mechanism is reported only where the mechanism is the decision being asked about.
- Faults that were found and have since been corrected.
  - Reported only where the fault still constrains the present situation, or where the correction is unverified. Where reported, the present constraint is the bullet, not the story.
- Foregone conclusions.
  - Anything that follows automatically from what was asked.
  - Standard practice that would have been done either way.
  - The request restated back to the user.
- The working behind a conclusion the user is not being asked to check.
  - The conclusion is stated. Where the conclusion is a judgement, the measurement that settles the judgement is given in the same bullet, never as its own section.
- Inventories: the files, tests, commands or tickets that were touched.
- Reassurance. An area that is healthy and needs nothing is silent.

## Sections

Use only these, in this order. Omit any section with nothing to say.

- **Where things stand** — the present situation, at most 4 bullets, in the present tense.
  - What has just changed, and what state that leaves things in.
  - Anything now blocked, and what the block is waiting on.
- **Up next** — at most 4 actions, in priority order, each beginning with the action.
  - Nest a condition only where the action cannot start without the condition.
  - Where an action waits on a decision below, say which decision.
- **Decisions needed** — one question per bullet, each answerable exactly as written.
  - Give the options as nested bullets where the question is a choice between named alternatives.
  - A recommendation is allowed as a nested bullet beginning "Recommended:".
  - Omit the section where nothing is genuinely blocked on the user.
- **Flags** — at most 5 items, one line each, no nesting.

## Flags

An item belongs in Flags precisely because it was judged not to warrant a place in the sections above. The section exists so that judgement is visible and cheap to overrule, rather than silent.

- Each line states what was observed or done, and that it was set aside without asking.
- Include judgement calls made unilaterally, work deliberately skipped, assumptions left unverified, deviations from what was asked, surprises found and parked, and costs or limits accepted.
- Do not use Flags as a back door for background, mechanism, or corrected faults.
- Omit the section entirely where nothing was set aside. Never pad it.

## Length

- The whole report fits on one screen.
- At most 4 bullets under any section title, and at most 5 flags.
- At most one level of nesting.

## Format

Follow the `/simple` format exactly: read `.claude/skills/simple/SKILL.md` and apply every rule in it.

- Open with the answer on a single bold line, before the first section title. The answer states what has happened or what is being waited on, not the topic.
- Bold one-line section titles that are not themselves list items.
- Bulleted facts only: no prose paragraphs, no numbered lists.
- Passive voice, no pronouns as standing subjects, one fact per bullet.
- Tools and services named directly; no file paths, identifiers or commit hashes.
- No em-dashes; dates written as D-Mon-YYYY.

Two rules of `/simple` are overridden here:

- Questions are required in "Decisions needed". `/simple` bans questions.
- A recommendation is allowed inside a decision without being requested, marked "Recommended:".

## Worked examples

- Rejected: "The count was under-reporting because the healing job wrote a null resolution value on every orphan row, which is why the totals never matched."
  - Accepted: "The count is now correct at 651. The bad rows are still in the database and are fixed by the pending backfill."
- Rejected: "As requested, a feature branch was created and conventional commits were used."
  - Accepted: omitted. Standard practice is a foregone conclusion.
- Rejected: "Three approaches were considered: keyset pagination, adaptive windows, and a per-market heal."
  - Accepted: "Which pagination fix is wanted: keyset, or adaptive windows? Recommended: keyset."
- Rejected, as a flag: "The database uses partitioned snapshot tables."
  - Accepted, as a flag: "The slowest test was skipped rather than fixed, without asking."

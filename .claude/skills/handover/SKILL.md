---
name: handover
description: Sweep the conversation for every open item (decisions owed, work unfinished, finished work untested, documents, tickets and specs left out of date), report them in /simple format split into do-now and next-session, then on confirmation do the do-now items and write the handover document into docs/handover. Invoke with /handover.
---

# /handover — close the session down cleanly

Read back over the whole conversation, find everything left open, and put it in
front of the user as a decision: what is worth finishing now, and what is worth
handing to the next session. Then act on the answer and leave one handover
document behind.

The handover document is a **one-shot baton, not a reference**. `/sync` reads it
at the start of the next session and deletes it. Write it for a reader who has
none of this conversation and cannot ask a question.

Nothing is written until the user has answered. The sweep and the report are
read-only.

## 1. Sweep the conversation

Go back over the session from its first message, not from memory of it. Every
open item comes from something actually said or done in the conversation, never
from a general sense of what a project like this usually needs.

Collect five kinds of open item:

- **Decisions owed by the user.** A question asked and not answered, a trade-off
  named and not settled, two viable options left side by side. Include anything
  the user was told was their call.
- **Work started and not finished.** Code half-written, a task begun then
  overtaken, a file edited but not wired up.
- **Work finished and not proven.** Code that exists but was never run, never
  observed, never tested. Say what would prove it, and say plainly that it is
  unproven rather than calling it done.
- **Records left behind the code.** A roadmap, spec, task list, ticket or
  `CLAUDE.md` that no longer matches what the code now does. Include a checked
  box with no evidence and an unchecked box describing code that already exists.
- **Uncommitted state.** Working-tree changes, an unpushed commit, a deleted file
  not yet committed. Check with `git status --porcelain`, do not assume.

Two rules on what counts:

- An item earns its place only where **someone must do something about it**. A
  thing that is simply true is not an open item.
- Where the conversation resolved something, it is closed. Do not resurrect a
  decision the user already made, and do not list a concern already answered.

## 2. Report, split into now and next

Write the report in **`/simple` format** — read `.claude/skills/simple/SKILL.md`
and follow it exactly: bold one-line section titles that are not list items,
bulleted facts only, passive voice, no pronouns as subjects, every tool and
service named directly, no em-dashes, no commit hashes, dates as D-Mon-YYYY.

**Very concise.** One line per item. The whole report fits on one screen. Where
a section would run past 5 items, the items are being enumerated rather than
grouped: collapse the small ones into a single grouped bullet.

Use these sections, in this order, omitting any with nothing in it.

- **Decisions needed** — each one the user's call, stated as the choice itself,
  not as background to the choice.
- **Suggested for this session** — items that are cheap, mechanical, or that
  would go stale if carried over. Each line names the item and the verb.
- **Suggested for the next session** — items needing a fresh context, a rebuild,
  a live observation, or an answer that has not arrived. Each line says what the
  item is waiting on.

Sorting rule: an item belongs to **this session** when it can be finished in
code right now with what is already in context, and doing it now prevents a
handover claim from being written unverified. An item belongs to the **next
session** when it needs a decision, a rebuild, an owner action, an external key,
or an observation that cannot be taken now.

Close with a single line asking which items to do now, and stating that the
handover document is written either way. That line is not a section and carries
no bullet.

Then **stop and wait.** Do not begin any of the work, and do not write the
handover document, until the user has answered.

## 3. Do the confirmed work

Do exactly what the user confirmed, and nothing adjacent to it.

- Where the user confirms an item, finish it fully. A partly-done item is worse
  than an untouched one, because the handover document will record it as done.
- Where the user declines an item, it moves to the next-session list unchanged.
  Do not argue it back in.
- Where an item turns out to be blocked once started, stop, and record it in the
  handover document as blocked with the reason. Never record it as done.
- Follow the repo's own governance while doing it. In particular, a task box is
  checked only with evidence, and a task that cannot be finished in code moves to
  Linear rather than sitting unchecked.

## 4. Write the handover document

Location is `docs/handover/`. Create the directory where it does not exist.

- **A document for today already in `docs/handover/`** → update that document in
  place, rewriting it whole so the state it describes is the state at the end of
  this session. Do not append a second session's notes underneath the first.
- **No document for today** → create `docs/handover/TEMP-<D-Mon-YYYY>.md`, using
  today's date, for example `TEMP-11-Aug-2026.md`.

Older documents in `docs/handover/` are left alone. `/sync` reads and deletes
them at the start of the next session.

The document opens with the delete-after-reading declaration, so `/sync`
recognises it whatever the filename:

```markdown
# Handover — DELETE AFTER READING

**Written <D-Mon-YYYY>. Disposable by design.**

This is a one-shot baton, not a reference. Read it once, act on it, then delete
it. Never cite it as a source and never update it in place in a later session.
```

Then, in this order, and only the parts that have content:

- **Where the durable record lives.** Point at the roadmap, the specs and any
  document `CLAUDE.md` names as canonical, and state that those documents win
  wherever this one disagrees.
- **What this session changed.** What now works that did not before, said by
  behaviour rather than by file. Include what was measured, with the numbers.
- **What was decided.** Each decision and the reason, with the date and who made
  it. A decision recorded without its reason gets re-litigated.
- **Decisions still owed.** Each open choice and what it blocks.
- **Pick up here.** The single next increment, stated concretely enough to start
  without re-deriving it, and the gate that says it is done.
- **Traps.** Anything that will mislead the next session: a placeholder that
  looks like a measurement, a number taken under conditions that no longer hold,
  a lever that is not a lever. Mark each one plainly.
- **Tried and rejected.** Approaches already ruled out, each with the reason, so
  they are not re-proposed.
- **How to run it.** The exact commands, and any rebuild or warm-up rule that
  makes an observation valid.

Rules for the writing:

- Every claim is dated or is attributed to a document that is dated. An undated
  claim in a handover document is exactly how a stale one misleads.
- A number is reported with the conditions it was taken under. A number whose
  conditions no longer hold is marked as not carrying over.
- Unproven work is described as unproven. Never write a gate as passed where the
  observation was not taken.
- Do not restate what the roadmap and the specs already hold. Point at them.

Finish by telling the user, in one line, which document was written or updated,
and which confirmed items were completed.

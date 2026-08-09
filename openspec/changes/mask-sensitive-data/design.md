## Context

Sessions are streamed. A value printed into a session is published, and the
8-Aug-2026 leak reached a VOD that way.

The leak path was measured before designing. Every committed script in this
repository uses synthetic addresses, and the same holds in `../eco3d.shop`. The
address that leaked came from a query composed during the session and run
against production. So the code that leaked did not exist before the session
began and will not exist afterwards, which rules out any approach that depends
on editing scripts.

That leaves the boundary where a tool result crosses into the session. The hook
contract was checked against the Claude Code documentation before choosing:
`PostToolUse` accepts `hookSpecificOutput.updatedToolOutput`, which replaces the
tool's result before the session receives it. That is a genuine interception
rather than an after-the-fact redaction, and it is the property this design
rests on.

Two weaker mechanisms were considered and rejected as the primary layer.
`MessageDisplay` replaces only what is drawn on screen and leaves the transcript
holding the original. `PreToolUse` can block a command, but it must judge intent
from a command that has not run yet, so it either blocks far too much or misses
the query whose output happens to contain an address.

## Goals / Non-Goals

**Goals:**
- A sensitive value never enters the session transcript.
- The safeguard holds for code written during a session, not only for code in
  the repository.
- Masked output stays useful: two different accounts remain distinguishable, and
  the reader is told that masking happened.
- A value can still be read deliberately, by asking first.
- The same protection covers `../eco3d.shop`.

**Non-Goals:**
- Redacting the existing 8-Aug-2026 recording. That is AZ-236 and AZ-239.
- Controlling what the site shows a viewer. Nothing here changes application
  behaviour.
- Detecting sensitive values inside binary content, images or video frames.
- Preventing a determined reveal. The reveal path is deliberate and its whole
  purpose is to work.

## Decisions

**Interception happens in `PostToolUse`, using `updatedToolOutput`.**
The value is replaced before the session sees it, so nothing has to be trusted
to forget what it read. The alternative, an instruction telling the session not
to print what it has already been shown, fails exactly when it matters, because
by then the value is in the transcript.

**Matching is a fixed pattern set, not a model call.**
The hook runs on every tool result, so it has to be fast and deterministic. A
model call would add latency to every tool call and would itself be a place a
sensitive value travels to. Patterns cover: email addresses; JSON Web Tokens;
bearer tokens and keys carrying a recognisable prefix; long random-looking
secrets adjacent to a key-like name; phone numbers; and postal addresses.

**Identifier columns are not masked by pattern.**
Account identifiers are ordinary identifiers, and masking every identifier would
make debugging impossible. They are handled by the query rule below instead.

**Masking preserves shape.**
`aaron@gazzola.dev` becomes `a****@g******.dev`. Two different addresses produce
two different masks, so a result set with several accounts is still readable as
several accounts. A mask that collapsed everything to one token would destroy
the result rather than protect it.

**Masking announces itself.**
The replaced output carries a trailing line stating how many values were masked
and of which categories, so a reader can tell the difference between a result
with no addresses and a result whose addresses were hidden.

**Coverage is chosen by where production data enters, not by tool name.**
Shell output, Supabase query results and file reads all carry production data.
The hook matches those, rather than trying to enumerate safe tools, because the
list of unsafe tools grows and the list of entry points does not.

**The reveal path is a separate, explicit act.**
An environment variable consulted by the hook turns masking off for one command.
Setting it is visible in the command itself, so revealing is a thing the viewer
of a stream can see happening rather than a silent default.

**The rule set lives in one file, shared by copy.**
The two repositories are separate, so the hook and its patterns are duplicated
rather than imported. The duplication is deliberate: a shared dependency between
the two repositories would be a heavier commitment than a file that changes
about once a year. The `../eco3d.shop` change carries the same file.

**A written rule backs the hook.**
The hook covers what tools return. The repository guidance covers what the
session itself composes, such as an address typed into a commit message.

## Risks / Trade-offs

- **A pattern misses a category nobody anticipated** → The masking notice states
  what was matched, so a gap is visible rather than silent, and the pattern set
  is one file to extend. The written rule is the backstop for the unanticipated
  case.
- **Masking corrupts output that is not sensitive**, such as an example address
  inside documentation being read → Accepted. A masked example is a cosmetic
  loss; a leaked address is not recoverable once streamed.
- **The hook fails or is misconfigured, and nobody notices** → The hook is
  verified by a test that feeds it a known payload and asserts the output is
  masked, so a broken hook fails a test rather than failing silently on stream.
- **Latency on every tool result** → Matching is a fixed pattern pass over text
  already in memory, with no network and no model call.
- **The reveal path is left switched on** → It is scoped to a single command
  rather than to a session, so it cannot persist by being forgotten.
- **The two repositories drift** → Accepted, and cheap to detect: the file is
  identical by construction, so a comparison is a single diff.

## Migration Plan

- Nothing to migrate. The hook is additive, and no existing behaviour depends on
  unmasked output.
- Rollback is deleting the hook registration from `.claude/settings.json`.

## Open Questions

None. The hook contract was confirmed against the documentation, and the leak
path was measured rather than assumed.

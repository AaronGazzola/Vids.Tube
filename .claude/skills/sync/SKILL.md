---
name: sync
description: Refresh the local skills from the shared skills repo first, including this one, then pull the latest git state and sync it against Linear, OpenSpec, the roadmap docs and Supabase, read and delete any handover document left for this session, then report in /simple format on branches, tickets, specs and roadmap position, ending with next steps. Hard-fails if git, the Linear MCP or the Supabase MCP is unreachable. Invoke with /sync.
---

# /sync — project state sync + next-steps report

Gather the live state of git, Linear, OpenSpec, the roadmap docs, Supabase and
the shared skills repo, cross-reference all of them against the actual code, and
produce one short report that ends with the next steps.

Only four writes are permitted, and no other: a fast-forward `git pull`, a
fast-forward `git pull` inside the shared skills clone, copying a newer skill
file from the shared skills repo into this repo, and deleting a handover
document that has been read into context. Nothing is ever written to Linear,
OpenSpec, Supabase, Vercel or any deployment.

Every command in this skill authenticates with credentials that already exist:
the user's SSH key for git, and already-connected MCP servers for Linear and
Supabase. No command here can open a browser, print a device code, or wait on an
OAuth callback. Do not add one.

## 0. Load config

Read `.claude/sync.config.json` at the repo root.

- If it does **not** exist, do not guess. Tell the user the skill is not yet
  configured for this project, offer to scaffold one from
  `sync.config.example.json` (in this skill folder), then stop.
- Skip any integration where `enabled` is `false` or absent — do not call its
  tools, and note it in one line at the end of the report as "not configured".
- `mainBranch` is the trunk (default `main`); `project` is the name used in the
  heading.

## 1. Access gate — fail loudly, never report partially

Before gathering, confirm the three **required** sources are reachable:

| Source | Check |
| --- | --- |
| git | `git rev-parse --is-inside-work-tree` and `git fetch` both succeed |
| Linear MCP | `list_teams` (or `list_projects`) returns the configured team/project |
| Supabase MCP | `list_projects` returns `supabase.projectRef` |

If any required source is unreachable — an MCP server not connected, no network,
`projectRef` absent from the account the MCP is connected to — **stop**. Report
exactly which source failed and the one-off command or connector setup the user
must do themselves. **Do not produce the report from partial data**, and do not
substitute inference for a source you could not read.

There is no fallback path for Supabase. The Supabase MCP must be connected. Do
not substitute the Supabase CLI, and do not report a database section built from
migration files alone.

## 2. Shared skills repo — `skills.enabled`

**This runs before anything is gathered, and before this file's own instructions
are trusted.** The skills in this repo are copies of the skills in the shared
skills repo named by `skills.repo`, and this skill is one of them. Sorting the
copies out inside the gather phase would be too late: the instructions being
followed would already be the stale ones.

```bash
# clone once per run, into a scratch dir, over SSH
git clone --depth 50 <skills.repo.ssh> <scratch>/skills-repo
```

Compare every skill folder under `skills.path` (default `.claude/skills`) on
both sides. Compare file **content ignoring line endings** — this repo stores
CRLF and the shared repo stores LF, so a naive byte comparison reports every
file as different:

```bash
diff -q --strip-trailing-cr <shared-file> <local-file>
```

For each file whose content genuinely differs, decide which side is newer, then
act on that:

```bash
git status --porcelain -- <path>     # uncommitted local edit?
git log -1 --format=%cI -- <path>    # otherwise, last-commit date
```

A local file with uncommitted changes is **always** treated as the newer side,
whatever the commit dates say, because the local edit has not been committed yet
and its commit date is therefore stale. Never overwrite an uncommitted local
edit.

- Shared repo newer → **copy the shared version over the local one, silently.**
  This is a permitted write and it is **not reported**: a skill arriving from the
  shared repo needs no decision from the user.
- A skill present in the shared repo and missing here → copy it in, silently, for
  the same reason.
- Local repo newer → **do not push**, and **report it**. Name the skill and give
  a one-line summary of what the local version changed, then ask whether the
  local version should be pushed to the shared repo.
- Dates equal but content differs → report as a conflict and ask; never guess.

Copy the file exactly. Read and write it as **UTF-8 explicitly**: reading a
UTF-8 file as the system codepage silently mangles every non-ASCII character,
and the corruption looks like an unrelated edit on the next comparison.

### Then re-read this skill before continuing

Where the copy above replaced **this skill's own file**, the instructions
currently in context are the ones that were just superseded.

- Read the updated file from disk and follow **that** version for the rest of the
  run, including its report format and any step this version does not have.
- Where the updated version changes what must be gathered, gather it. Do not
  carry a conclusion drawn under the old instructions into the new report.
- Say nothing about this in the report. A skill arriving from the shared repo
  needs no decision from the user, and that includes this one.

### What reaches the report

The **only** reason this section appears in the report is a local version the
user may want pushed to the shared repo. Where every difference resolved in the
shared repo's favour, the section is omitted entirely and no bullet mentions
skills at all.

Only skills that exist on **both** sides are compared. A skill that exists here
and not in the shared repo is out of scope: it is not compared, not pushed, and
not mentioned in the report at all.

Never push to the shared repo without the user saying so in the current
conversation.

## 3. Gather (run independent reads in parallel)

### Git — `git.enabled`

```bash
git pull --ff-only            # pull the latest; report if it cannot fast-forward
git fetch --all --prune
git status -sb
git branch -a -vv --sort=-committerdate
git log --oneline --date=short --format='%h %ad %d %s' -15
```

Remotes are SSH and authenticate with the user's SSH key. A prompt for a
username or password means the remote is misconfigured as `https://`; report
that rather than answering it.

Capture:
- Current branch; clean or dirty (list uncommitted/untracked paths).
- Ahead/behind vs upstream for the current branch.
- **Which branch holds the most recent commit** (local and remote), with its
  date and subject.
- Branches merged into `mainBranch` (deletable) vs. unmerged with unique work.
- Whether `mainBranch` is behind any feature branch.

### Deployment — `vercel.enabled`

Vercel deploys on push, through its GitHub integration: a push to `mainBranch`
deploys to production, and a push to any other branch deploys a preview. Nothing
is deployed by hand.

Deployment state is therefore derived entirely from git, with no API call, no
CLI and no token:

- Unpushed commits on `mainBranch` are production changes that have not
  deployed. Flag them.
- Unpushed commits on the current feature branch have no preview yet. Flag them
  in one line.

Do not invoke the `vercel` CLI and do not invoke the `gh` CLI. Neither is needed:
`vercel ls` starts a device-login flow, and `gh` uses its own OAuth token rather
than the SSH key.

### OpenSpec — `openspec.enabled`

```bash
npx openspec list
```

For **each active change**, read `openspec/changes/<name>/tasks.md` (plus
`proposal.md` / `design.md` if present) and classify it by checking the code, not
the checkboxes:

- **Code-complete, needs verification** — every task that can be done in code is
  done; only testing/live confirmation remains. → the archive candidate. Name the
  exact verification step required.
- **In progress** — remaining tasks describe code that does not exist yet. → name
  the single next actionable task.
- **Stale / drifted** — unchecked boxes describe code that already exists (or was
  built differently elsewhere). → flag for reconciliation; never blindly
  re-implement (this is the process-poisoning vector in `CLAUDE.md`).
- **Blocked on a human** — an unchecked box that cannot be finished in code. →
  recommend moving it to Linear and removing the box.

Spot-check the files named in unchecked tasks to decide which bucket applies.

### Linear — `linear.enabled`

Scope every query to `linear.team` + `linear.project` from config.

- `list_issues` for states In Progress, Todo, and In Review, ordered by priority.
- For each: identifier, title, state, priority, labels (phase labels matter), and
  whether it maps to an active OpenSpec change or a git branch.
- Separate three groups explicitly:
  - **In progress needing verification only** — the code exists; the ticket is
    open because it has not been tested/confirmed. Say what test closes it.
  - **In progress with code still to write.**
  - **Backlog ideas** — never build straight from these; per governance a backlog
    item must first be promoted into a new OpenSpec change.

### Code cross-reference

For every spec/ticket claimed to be code-complete, verify against the repo:
locate the files, functions or migrations it names and confirm they exist and
behave as described. A checked box or a "Done" ticket with no matching code is a
finding, and so is finished code sitting under an open ticket.

### Database — `supabase.enabled`

Through the Supabase MCP only: `list_migrations` and `list_tables` for parity
against the migration files in `supabase/migrations`, `get_advisors` for security
and performance, `list_branches`. Use `execute_sql` for **read-only** sanity
checks only when a spec or ticket depends on live data (a row count, a flag's
value, whether a backfill ran), and only when the answer changes the report's
conclusion.

Flag: migration files not applied to the remote project, remote migrations
missing from the repo, and any security or performance advisor.

### Roadmap docs

Read the paths listed in `docs.roadmap`. If the config lists none, search
`docs/**/*roadmap*`, `ROADMAP.md`, and any doc `CLAUDE.md` names as canonical.

- `git log -1 --date=short -- <file>` for last-touched date, compared against the
  dates of recent feature commits.
- Check whether items marked "planned"/"next" are already shipped in code, and
  whether shipped work is missing from the doc.
- Verdict per doc: **current** or **stale**, naming the specific lines that are
  wrong.
- Then one line stating where the project actually stands: which phase is done,
  which is in flight, what the next milestone is.

### Handover documents — always, and read before anything is concluded

A handover document is a one-shot baton written by the previous session so the
next one can resume without re-deriving it. It is disposable by design and goes
stale the moment anything changes. It is **never** a reference and is **never**
cited as a source.

`docs/handover/` is where `/handover` writes them, so search there first, then
the repo root and the rest of `docs/`. Search tracked and untracked files, and
look for both forms:

- **The convention:** `TEMP` and a date in the filename, in any arrangement and
  any date format (`TEMP-11-Aug-2026.md`, `TEMP_2026-08-11-handover.md`).
- **The fallback:** any Markdown file whose own opening lines declare it
  delete-after-reading or call itself a handover, whatever the filename or
  wherever it sits. A document written before the convention existed is still a
  handover document.

Handle every document found, in this order:

- **Read it in full first**, before the roadmap, the spec and the tickets are
  judged. Its contents inform the whole report.
- **Decide current or stale.** A handover document is stale when a
  later-dated handover document exists, or when commits land after its date. The
  most recent handover document is the current one; there is only ever one.
- **Delete every handover document read**, current and stale alike. The current
  one is deleted because it has now been read; a stale one is deleted because it
  is superseded. Deletion needs no confirmation: the contents are in context and
  the file is recoverable from git history.
- **Never carry an undated claim from a handover document into the report as
  current.** Where a handover claim matters, confirm it against the code, the
  roadmap or the spec first, and report that source instead.

Where the active spec carries a task to rewrite a handover document, that task
now means writing a fresh `TEMP`-and-date file. Flag it where the task still
names the deleted path.

### Optional integrations

Run only when enabled, and give each one line in the report unless it is red:
Doppler (`doppler configs`, `doppler secrets --only-names` — names only, never
values; flag if the locally selected config differs from `doppler.config`),
Sentry (unresolved issues from the last 48h by event count), Trigger.dev (recent
run statuses; flag failed or stuck).

## 4. Report

Everything gathered above is held in context so the user can ask follow-up
questions. Almost none of it is printed. The report is a **synthesis, not an
inventory**: the user is being told where the project stands and what to do
next, in the fewest bullets that carry the meaning.

Write it in **`/simple` format** — read `.claude/skills/simple/SKILL.md` and
follow it exactly: bold one-line section titles that are not list items,
bulleted facts only, no prose paragraphs, no numbered lists, passive voice, no
pronouns as subjects, every tool and service named directly, no commit hashes,
no em-dashes, dates as D-Mon-YYYY.

### What the report is for

The user reads this to answer one question: *what do I need to know to keep
going?* Every bullet earns its place by changing what the user does next. A
bullet that merely proves the gathering happened is deleted.

- **Synthesize, do not enumerate.** State the conclusion drawn from a source,
  not the rows read from the source.
  - Rejected: six bullets, one per advisory.
  - Accepted: "Six database warnings are open, none high risk."
- **Green gets one reassuring bullet, never a list.** Where an area is aligned
  and needs no action, say so in one line and move on.
  - Accepted: "Database migrations are aligned between the repository and Supabase."
- **Dead work is one bullet, as a group.** Abandoned branches, superseded
  approaches and cancelled tickets are named as a count and a shared cause, never
  itemised. Where dead work needs a decision, that decision is the bullet.
- **Name a thing only where the user must act on that thing.** A ticket
  identifier, spec name or branch name appears when the user will open it. It
  does not appear as evidence.
- **No inventories of healthy things.** Branches with no work in progress,
  passing checks, and integrations that are fine are all silent.

### Length

- The whole report fits on one screen.
- At most 4 bullets under any section title, and at most one level of nesting.
- Nesting is used only where a next step needs its condition stated.
- Where a section would exceed 4 bullets, the bullets are being enumerated
  instead of synthesized: collapse them.

### Sections

Use only these, in this order. Omit any section with nothing to say.

- **Handover read and deleted** — one bullet per handover document handled, at
  most 3, omitted entirely when none was found.
  - Each bullet carries the document's date, whether the document was current or
    stale, one clause saying what the document contained, and that the document
    was deleted.
  - The contents themselves are not reproduced: what a handover document says
    about the project belongs in the sections below, confirmed against the code.
- **Where things stand** — the position, in at most 4 bullets.
  - Which branch is checked out, whether that branch holds the latest work, and
    whether anything is undeployed.
  - Whether the roadmap, the active spec and the tickets agree on the current
    direction, said as one judgement rather than three verdicts.
  - How far through the current phase the work is.
  - Anything abandoned, as a single grouped bullet.
- **Needs attention** — at most 4 loose ends, each one the user must decide or
  clean up. State what is wrong and what closes it, in one line each.
  - A skill whose local version is newer than the shared repo's belongs here, as
    the one question it raises: push the local version, or not.
- **Continue here** — at most 4 next actions, in priority order, each beginning
  with the spec, ticket or branch and then the verb.
  - Nest a condition only where an action cannot start without it.
- **Next batch** — at most 3 tickets recommended for the block of work after the
  current one, one line each saying why the ticket is ready. Include only when
  the current work is near enough to done that the question is live.

Close with a single line offering the detail held in context, naming the areas
where detail exists. That line is not a section and carries no bullet.

Priority order within **Continue here**: unblock anything red first; then verify
and archive work that is already code-complete; then finish the in-progress spec;
then reconcile a stale document or ticket; and only then start new work promoted
from a backlog item.

## Installing into a new project

1. Copy this `sync/` folder into the project's `.claude/skills/`.
2. Copy `sync.config.example.json` to `.claude/sync.config.json` and fill in the
   identifiers, enabling only the integrations that project uses.
3. Keep `.claude/sync.config.json` in the project repo; updating the skill later
   never touches it.
4. `/sync` reads `.claude/skills/simple/SKILL.md` for its output format — install
   the `simple` skill alongside it.

---
name: sync
description: Refresh the local skills from the shared skills repo first, including this one, then pull the latest git state and sync it against Linear, OpenSpec, the roadmap docs and Supabase, read and delete any handover document left for this session, then report the branch position and any loose end with no ticket behind it, and close by rendering the full ordered work list through the tasks skill. Absences are never printed. Hard-fails if git or the Linear MCP is unreachable. Invoke with /sync.
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

Two sources are **required**, because the report's main body is the task list and
the task list cannot be built without them:

| Source | Check |
| --- | --- |
| git | `git rev-parse --is-inside-work-tree` and `git fetch` both succeed |
| Linear MCP | `list_teams` (or `list_projects`) returns the configured team/project |

If either is unreachable — an MCP server not connected, no network, no team or
project matching the config — **stop**. Report exactly which source failed and
the one-off command or connector setup the user must do themselves. **Do not
produce the report from partial data**, and do not substitute inference for a
source you could not read.

Every other source is **reported when reachable and named when not**. Where
Supabase, Doppler, Sentry or Trigger.dev cannot be read, the run continues, and
one bullet under **Could not be gathered** names the source and the action that
fixes it. A source that could not be read is never inferred from something else:
no database section is built from migration files alone, and the Supabase CLI is
not substituted for the Supabase MCP.

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

**Gather what the `tasks` skill's own gather step asks for**, so that step 5 can
render from context without reading Linear a second time. Read
`.claude/skills/tasks/SKILL.md` and follow its Linear gather rules, which in
summary are:

- `list_issues` for the confirmed team and project, for **every state whose type
  is `started`, `unstarted`, `backlog` or `triage`**. Do not filter by state
  name; workspaces rename states, and a renamed state must not vanish silently.
- `list_issue_statuses` for the team, to map each state to its type.
- Per issue: identifier, title, state and state type, priority, labels, assignee
  presence, whether an OpenSpec change or a branch is named, and whether another
  issue is named as a blocker or a parent.
- Descriptions for every `started` issue, every issue matched to a change, and
  any issue whose title does not say what the work is.

Grouping, pairing and ordering are the `tasks` skill's job, not this one's. Do
not pre-group here.

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
- **Report a roadmap document only when it contradicts the code**, naming the
  specific lines that are wrong. A document that matches is not mentioned.
- Where the project's actual phase position matters, it is carried by the task
  list, not stated as a verdict here.

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

Run only when enabled, and report each **only** when it is red or unreachable:
Doppler (`doppler configs`, `doppler secrets --only-names` — names only, never
values; flag if the locally selected config differs from `doppler.config`),
Sentry (unresolved issues from the last 48h by event count), Trigger.dev (recent
run statuses; flag failed or stuck).

## 4. Report

Everything gathered above is held in context so the user can ask follow-up
questions. Almost none of it is printed. The report answers one question: *what
changed, what is broken, and what should be picked up first?*

The last of those three is not written here. **The ordered list of open work is
rendered by the `tasks` skill**, and this skill's own sections carry only what
that list cannot.

### Never print an absence

A bullet exists to change what the user does next. A bullet saying that nothing
happened cannot do that, so it is not written.

- **Never state that something was not found, was clean, matched, or agreed.**
  No "no handover document was found", no "skills matched the shared repo", no
  "migrations are aligned", no "everything gathered".
- **Never state that the gathering happened.** The report is the evidence.
- An area with nothing wrong is silent. Its section is omitted, without comment.
- The two exceptions, which are statements rather than absences: a source that
  **could not** be gathered, and a handover document that **was** read.

### Route every fact to the list first

The task list is the main body of the report. Before a fact is written into a
section here, ask whether it belongs on a task line instead, and where it does,
put it there and write nothing here.

Facts that belong to the task list, never to a section of this skill:

- Anything with a Linear ticket or an OpenSpec change behind it, including a
  security hole that already has a ticket.
- How many changes are active and how far along each one is.
- Work that is code-complete and waiting on a live broadcast or a test.
- Verification tickets held against a finished phase.
- Dead work: cancelled tickets, duplicates, and branches or worktrees holding
  nothing unique.

What stays here, because no ticket or change holds it:

- A source that could not be gathered.
- A handover document that was read.
- The branch position, and any branch holding work that is not merged or not
  pushed.
- Uncommitted paths in this worktree.
- A roadmap document that contradicts the code.
- A skill whose local version is newer than the shared repo's.
- A security or database finding with no ticket behind it, which is then named
  as needing one.

### Length and shape

Follow the `/simple` format: read `.claude/skills/simple/SKILL.md` and apply it,
with the same exceptions the `tasks` skill takes, so both halves of the report
read as one document. Bold one-line section titles that are not list items,
bulleted facts only, no prose paragraphs, no numbered lists, passive voice, no
pronouns as subjects, every tool and service named directly, no commit hashes,
no em-dashes, dates as D-Mon-YYYY.

- The sections before the task list fit in well under half a screen.
- At most 4 bullets under any section title.
- Nested unordered bullets throughout, in the same shape the `tasks` skill uses:
  a short top line that stands on its own, and any qualifier nested beneath it
  rather than added as a clause.
- A bullet needing a second clause is a bullet and a nested bullet.

### Sections

Use only these, in this order, then the task list. Omit any section with nothing
to say, without comment.

- **Could not be gathered** — one bullet per source that failed, naming the
  source and, nested, the one action that fixes it.
- **Handover** — only when a handover document was found. One bullet per
  document, at most 3, carrying its date, one clause on what it contained, and
  that it was deleted.
  - What a handover document claims about the project is not reproduced. It is
    confirmed against the code and reported as a task or as a finding below.
- **Branches** — the position in at most 4 bullets.
  - Which branch is checked out and how it sits against the trunk and its
    upstream, with the reason nested where a difference is unimportant.
  - Any other branch holding work that is neither merged nor pushed.
  - Uncommitted or untracked paths in this worktree, as one bullet naming them.
- **Needs attention** — at most 4 loose ends that no task line already carries,
  each stating what is wrong on the top line and what closes it nested beneath.

Worked shape for **Branches**:

- `dev` is checked out and level with its remote, one commit ahead of `main`.
  - That commit changes documentation only, so nothing of substance is
    undeployed.
- Three paths are uncommitted here, including an untracked `tasks` skill folder
  that matches the shared repo.
  - Committing it is all that is needed.

Rejected:

- "`dev` is checked out, holds the latest work and is level with the remote;
  `main` sits one documentation-only commit behind." Three facts in one line,
  where two of them are qualifiers.
- "The roadmap, the active specs and the tickets agree on direction." An
  absence. Alignment is reported only when it is broken.

## 5. The task list

Render the open work by following the `tasks` skill, and print its output as the
final and largest part of the report.

- **Read `.claude/skills/tasks/SKILL.md` from disk and follow it**, after step 2
  has run. Step 2 may have just replaced that file, so the version in context at
  the start of the run is not the one to follow.
- **Do not gather twice.** Everything the `tasks` skill gathers has already been
  gathered above: the Linear issues, the active changes and their task files, and
  the branch list. Render from what is in context, and read only what is
  genuinely missing, such as the description of an issue not yet pulled.
- **Follow its grouping, categorising, ordering, capping and two-level line shape
  exactly.** No group is added, renamed or merged to suit this report.
- **Pass on the wider context.** This skill has read the roadmap, the deployment
  position, the database advisors, the dirty worktree and any handover document,
  and the `tasks` skill on its own has none of that. Use it where it changes
  which task is most pressing, and say on the line why the placement was made.
- Its **Open items** section is kept, and it holds the record-level
  inconsistencies. **Needs attention** above holds only findings with no record
  at all, so nothing is written in both.

The `tasks` skill ends with a single line offering the detail held in context.
**That line closes the whole report, and it is written once.** Widen it to name
this skill's areas too, such as the roadmap, the database and the deployment
position, rather than adding a second closing line beneath it.

## Installing into a new project

1. Copy this `sync/` folder into the project's `.claude/skills/`.
2. Copy `sync.config.example.json` to `.claude/sync.config.json` and fill in the
   identifiers, enabling only the integrations that project uses.
3. Keep `.claude/sync.config.json` in the project repo; updating the skill later
   never touches it.
4. `/sync` reads `.claude/skills/simple/SKILL.md` for its output format — install
   the `simple` skill alongside it.

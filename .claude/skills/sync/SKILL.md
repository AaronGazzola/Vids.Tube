---
name: sync
description: Pull the latest git state and sync it against Linear, OpenSpec, the roadmap docs and the database, then report in /plain format on branches, tickets, specs and roadmap position, ending with next steps. Hard-fails if git, Linear or Supabase are unreachable. Invoke with /sync.
---

# /sync — project state sync + next-steps report

Gather the live state of git, Linear, OpenSpec, the roadmap docs and the
database, cross-reference all four against the actual code, and produce one
concise report that ends with the next steps.

This skill is **read-only except for `git pull`**. It never mutates Linear,
OpenSpec, the database, or any deployment.

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
| Supabase | the MCP sees `supabase.projectRef` via `list_projects`, **or** the CLI is linked (`npx supabase projects list`) |

If any required source is unreachable — MCP not authenticated, no network, repo
not linked, `projectRef` absent from the account the MCP is authenticated to —
**stop**. Report exactly which source failed and what it needs (authorize the
MCP, `doppler run`, `supabase link`, etc.). **Do not produce the report from
partial data**, and do not substitute inference for a source you could not read.

The one allowed degradation: if the Supabase **MCP** cannot see the ref but the
**CLI** is linked, continue using the CLI and say so. If neither works, stop.

**Never start an interactive login.** This skill only ever reads through
credentials that already exist. If any command would open a browser, print a
device code, or wait on an OAuth callback (`vercel login`, `gh auth login`,
`doppler login`, `supabase login`), do not run it and do not let a command run
that falls into one — check the authenticated state first, or use a path that
cannot prompt. An unauthenticated tool is simply an unreachable source: report
it as such and name the one-off command the user must run themselves.

## 2. Gather (run independent reads in parallel)

### Git — `git.enabled`

```bash
git pull --ff-only            # pull the latest; report if it cannot fast-forward
git fetch --all --prune
git status -sb
git branch -a -vv --sort=-committerdate
git log --oneline --date=short --format='%h %ad %d %s' -15
```

Remotes are SSH. `git fetch`/`git pull` authenticate with the user's SSH key and
must never prompt for a username or password; a credential prompt means the
remote is misconfigured (an `https://` remote), so report that instead of
answering it.

The SSH key covers **all** ref state — branches, ahead/behind, commits, tags,
file contents on any remote branch (`git show <remote-branch>:<path>`), merge
and ancestry checks. Use plain `git` for every one of these. Do **not** reach for
the `gh` CLI or a GitHub token for anything git can answer, and never report a
missing `gh` login as a blocker to the git section.

Capture:
- Current branch; clean or dirty (list uncommitted/untracked paths).
- Ahead/behind vs upstream for the current branch.
- **Which branch holds the most recent commit** (local and remote), with its
  date and subject.
- Branches merged into `mainBranch` (deletable) vs. unmerged with unique work.
- Whether `mainBranch` is behind any feature branch.

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

Use **both** paths where each is stronger, per `supabase.method`:

- CLI: `npx supabase migration list` — local vs remote migration parity.
- MCP: `list_tables`, `list_migrations`, `get_advisors` (security + performance),
  `list_branches`; `execute_sql` for **read-only** sanity checks when a spec or
  ticket depends on live data (row counts, a flag's value, whether a backfill
  ran). Only query when it changes the report's conclusion.

Flag: local migrations not pushed, remote migrations missing from the repo, and
any security/performance advisor.

### Roadmap docs

Find them (`docs/roadmap.md`, `ROADMAP.md`, `docs/**/roadmap*`, plus any doc the
config or `CLAUDE.md` names). For each:

- `git log -1 --date=short -- <file>` for last-touched date, and compare against
  the dates of recent feature commits.
- Check whether items marked "planned"/"next" are already shipped in code, and
  whether shipped work is missing from the doc.
- Verdict per doc: **current** or **stale**, with the specific lines that are
  wrong.
- Then a one-or-two-line statement of **where the project actually is** in the
  roadmap: which phase is done, which is in flight, what the next milestone is.

### Optional integrations

Run these only when enabled, and keep each to one line in the report unless it
is red: Doppler (`doppler configs`, `doppler secrets --only-names` — names only,
never values, and flag if the locally selected config differs from
`doppler.config`), Vercel (see below), Sentry (unresolved issues from the last
48h by event count), Trigger.dev (recent run statuses; flag failed/stuck).

**Vercel — `vercel.enabled`.** Deploys are wired through the Vercel GitHub
integration: a push to `mainBranch` deploys to production automatically, and
every other pushed branch gets a preview. Nothing is deployed by hand, and no
GitHub Actions deploy workflow is involved. Read the deployment records that
integration writes back to GitHub, via the already-authenticated `gh` CLI:

```bash
gh api repos/<owner>/<repo>/deployments --jq '.[0:5][] | "\(.created_at) \(.environment) \(.sha[0:7]) \(.id)"'
gh api repos/<owner>/<repo>/deployments/<id>/statuses --jq '.[0].state'
```

Report the latest **production** record: state, short SHA, and whether that SHA
is the current tip of `mainBranch`. Flag a non-`success` state, and flag a
production SHA behind `mainBranch` (a push that never deployed). Mention the
newest preview only when its state is not `success`.

Deployment records are the one thing SSH cannot reach: they live behind the
GitHub REST API, which needs a token. If `gh auth status` reports no login, this
integration is simply unreadable — give it one line in the optional-integrations
note and carry on. It is **never** a blocker, and it never affects the git,
OpenSpec, Linear, database or roadmap sections.

Do **not** invoke the `vercel` CLI. It is not logged in and `vercel ls` silently
starts a device-login flow that blocks until it times out.

## 3. Report

Write the whole report in **`/plain` format** — read
`.claude/skills/plain/SKILL.md` and follow it exactly: bold one-line section
titles, bulleted facts nested at most two deep, no prose paragraphs, no
em-dashes, code identifiers in backticks, dates as D-Mon-YYYY. Be very concise:
facts only, no narration of the gathering process.

Sections, in this order:

1. **Blockers** — anything red. Omit the section entirely if nothing is red.
2. **Branches** — current branch, dirty/clean, ahead/behind; branch with the most
   recent changes; the branch that should be worked on next.
3. **OpenSpec** — one item per active change: status bucket, tasks done/total,
   next action. Call out changes that need only verification to archive.
4. **Linear** — the three groups from above. Call out tickets that need only a
   test to close, with the test.
5. **Database** — migration parity, advisors, any live-data finding.
6. **Roadmap** — per-doc current/stale verdict, and where the project stands.
7. **Overview** — the synthesis, in two labelled groups:
   - Code and branches.
   - Tickets, specs and roadmap alignment (where they agree and where they drift).
8. **Summary** — very short. Two or three bullets of state, then a bulleted
   **Next steps** list, ordered, one line each, each naming a concrete ticket,
   spec or branch and the action (build / test / verify / archive / reconcile).

Prioritize next steps in this order: unblock anything red; verify-and-archive
work that is already code-complete; finish an in-progress spec; reconcile a
stale spec or roadmap; only then start new work from a promoted backlog item.

## Installing into a new project

1. Copy this `sync/` folder into the project's `.claude/skills/`.
2. Copy `sync.config.example.json` to `.claude/sync.config.json` and fill in the
   identifiers, enabling only the integrations that project uses.
3. Keep `.claude/sync.config.json` in the project repo; updating the skill later
   never touches it.
4. `/sync` reads `.claude/skills/plain/SKILL.md` for its output format — install
   the `plain` skill alongside it.

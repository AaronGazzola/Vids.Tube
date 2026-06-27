---
name: sync
description: Sync the full state of the current project across git, OpenSpec, Linear, Supabase, Doppler, Vercel, Sentry and Trigger.dev, then report active tickets/branches/specs and recommend the single best branch + task to work on next. Invoke with /sync.
---

# /sync — project state sync + work recommendation

Gather the live state of every integration this project uses, cross-reference it
against the code and the spec backlog, then produce one report that ends with a
concrete recommendation: **which branch to be on and which task to do next.**

This skill is **environment-agnostic**. All project-specific identifiers (which
Supabase ref, which Linear team, which Doppler config, etc.) come from a config
file, never from this file. Read the config first; only touch integrations it
marks `enabled`.

## 0. Load config

Read `.claude/sync.config.json` at the repo root.

- If it does **not** exist, do not guess. Tell the user the skill is not yet
  configured for this project and offer to scaffold one from the schema in
  `sync.config.example.json` (in this skill folder), then stop.
- For every integration where `enabled` is `false` or absent, **skip that
  section entirely** — do not call its tools, do not mention it in the report
  except as a one-line "not configured" note at the end.
- `mainBranch` is the project's trunk (default `main`). `project` is the
  human-readable name used in headings.

Run the enabled sections below **in parallel** where possible (independent reads).

## 1. Git (if `git.enabled`)

```bash
git status -sb
git branch -vv --sort=-committerdate
git log --oneline -10
git fetch --quiet && git status -sb   # ahead/behind vs remote
```

Capture: current branch, ahead/behind counts, uncommitted/untracked files,
recent branches (with last-commit date), and whether the current branch is the
`mainBranch`. Flag a dirty working tree and any branch that is behind its
upstream.

## 2. OpenSpec (if `openspec.enabled`)

```bash
npx openspec list        # active changes + task progress (e.g. 13/16)
```

For **each active change**, read `openspec/changes/<name>/tasks.md` (and
`proposal.md` if present) and classify it by cross-referencing the code:

- **Completed** — all task boxes checked. → recommend archiving
  (`openspec-verify-change` then `openspec-archive-change`).
- **In progress** — some boxes checked, remaining boxes describe code that does
  not yet exist or differs from the spec. → this is candidate work.
- **Stale** — boxes are unchecked but the described code already exists / was
  implemented elsewhere (the spec drifted from reality), OR the change has had no
  related commits for a long time while its files moved on. → flag for
  reconciliation, do not blindly implement.
- **Blocked / needs human action** — an unchecked box that cannot be finished in
  code (live verification, external key, sign-off, a referenced Linear issue).
  Per this project's spec-governance rules, these should not live as unchecked
  boxes; recommend moving them to Linear.

To classify, spot-check the actual files named in the unchecked tasks (do they
exist? do they match the described behavior?) rather than trusting the checkbox.
Note for each change: status, % complete, and the single next actionable task.

## 3. Linear (if `linear.enabled`)

Use the Linear MCP tools. Scope to `linear.team` / `linear.project` from config.

- `list_issues` filtered to the configured team+project, state = active/started
  and todo, ordered by priority. Also list any issue in "In Progress".
- For the top issues, capture: identifier (e.g. AZ-78), title, state, priority,
  assignee, and whether it maps to an active OpenSpec change or a branch.
- Surface issues that are **promoted-but-not-built** (backlog ideas) separately
  from **in-flight** issues — per governance, never build straight from Linear;
  a backlog item must first become an OpenSpec change.

## 4. Supabase (if `supabase.enabled`)

Target `supabase.projectRef`. Honor `supabase.method`:

- `method: "mcp"` — use the Supabase MCP tools (`list_migrations`,
  `get_advisors`, `list_branches`). **First confirm the MCP can actually see
  `projectRef`** (`list_projects`); if the ref is absent, the MCP is
  authenticated to a different org — fall back to the CLI and note it.
- `method: "cli"` — use the linked Supabase CLI:
  `npx supabase migration list`, `npx supabase branches list`. (Use this when
  the MCP is pointed at another account.)

Either way:
- Compare remote migrations to local `supabase/migrations/` — flag any local
  migration not yet pushed, or remote migration not in the repo.
- Surface any security/performance advisors (MCP `get_advisors`) when reachable.
- Note preview branch state if branches are used.

Do **not** apply migrations or mutate anything; this skill is read-only.

## 5. Doppler (if `doppler.enabled`)

```bash
doppler configs --project <doppler.project>
doppler secrets --project <doppler.project> --config <doppler.config> --only-names
```

Confirm the expected config exists and which config is currently selected
locally (`doppler configure get config`). Flag if the local selection differs
from `doppler.config`. Never print secret values — names only.

## 6. Vercel (if `vercel.enabled`)

Prefer the Vercel CLI if available (`vercel ls`, `vercel inspect`); otherwise
read GitHub deployment status via `gh api repos/<owner>/<repo>/deployments`.
Report the latest production deployment state (ready/error/building) and the
commit it points at. Flag a failed latest deploy.

## 7. Sentry (if `sentry.enabled`)

Via the Sentry MCP/CLI for `sentry.org`/`sentry.project`: list unresolved issues
from the last 24–48h, ordered by event count. Report the top few with title,
count, and last-seen. Flag any new-since-last-deploy regression.

## 8. Trigger.dev (if `trigger.enabled`)

For `trigger.project`: list recent runs and their status. Flag failed/stuck runs
and any task with a rising failure rate.

## 9. Report + recommendation

Produce a single report in this order:

1. **Header** — `<project>` name, current branch, dirty/clean, ahead/behind.
2. **Per-integration status** — a short subsection each, only for enabled ones.
   Lead with anything red (failed deploy, security advisor, stuck run, stale
   spec, blocked task).
3. **OpenSpec board** — table of active changes: status, % complete, next task,
   human-action-needed flag.
4. **Linear board** — in-flight issues vs. backlog ideas.
5. **Recommendation** (the point of the skill): pick **one** branch + **one**
   next task and justify it in 2–3 lines. Prefer, in order:
   - finishing/unblocking an in-progress OpenSpec change over starting new work,
   - resolving anything red (failed deploy, security advisor) if it blocks
     shipping,
   - the highest-priority in-flight Linear issue that already has a spec.
   Then list runner-up options briefly so the user can override.
6. **Human-action queue** — bullet list of everything that needs the user (not
   code): blocked tasks to move to Linear, specs to archive, secrets to set,
   deploys to investigate.

Keep it scannable. Do not mutate any system — this skill only reads and advises.

## Installing into a new project

1. Copy this `sync/` folder into the project's `.claude/skills/`.
2. Copy `sync.config.example.json` to the repo's `.claude/sync.config.json` and
   fill in the identifiers, setting `enabled: true` only for the integrations
   that project actually uses.
3. Keep `.claude/sync.config.json` in the project repo (it is project-specific);
   updating the skill later never touches it.

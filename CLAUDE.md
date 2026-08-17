# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Sensitive data (read first)

**Development sessions are streamed and recorded. Anything written into a session is published.**

A `PostToolUse` hook masks sensitive values in tool results before they reach the session, so a value returned by a shell command, a Supabase query or a file read never enters the transcript. That covers what tools return. It does not cover what you write.

**Never write a sensitive value into a reply, a commit message, a ticket, a spec or a file without asking first.** This applies to a value learned earlier in the conversation, to one you inferred, and to one supplied by the user. Ask, and wait for an answer.

Sensitive means: email addresses, JSON Web Tokens, bearer tokens and API keys, secrets of any kind, account and auth identifiers, phone numbers, postal addresses, and any raw row from `auth.users`.

- When a value must be referred to, describe it instead: "the owner's address", not the address.
- When querying production, select a masked expression rather than the raw column, so the value is never fetched in the first place.
- Reading a value in full is deliberate and single-use: run that one command with `VIDSTUBE_REVEAL=1`. Never export it for a session.
- The masking rules live in `.claude/hooks/sensitive-mask.mjs` and are covered by `tests/unit/sensitive-mask.test.ts`. A category that leaks is a missing pattern plus a missing test case, and both are fixed together.
- The same safeguard exists in `../eco3d.shop`; the rule file is byte-identical in both repositories, so drift is a single comparison.

### Core Technologies

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **TailwindCSS v4** for styling
- **Shadcn/ui** for UI components
- **Supabase** for database and authentication (Remote only, no local db)
- **Zustand** for state management
- **React Query** for data fetching

# General rules:

- Format all responses in accordance with the `/simple` skill unless otherwise specified.
- All responses should be extremely concise, specific and focused on what the user needs to know
- Any skills from the "AI Resources" repository (public; owned by AaronGazzola) should match any changes made to the local version. 
- Don't include any comments in any files.
- Don't use `console.log` in any app code unless requested, delete all logs after the related development is completed
- Error handling follows the expected-vs-unexpected split (see "Error handling in actions" below) - no silent "fallback" functionality
- All errors should be logged with `console.error`
- Import "cn" from "@/lib/utils" to concatenate classes.
- Don't use middleware - route protection and feature gating should be handled by database queries implemented in react-query hooks.

# Loading skeletons

- Full page UI should be loaded initially, with loading skeletons data-dependent content
- Loading skeletons should only replace the content that requires data
  - Example: if a username is loading then only the username text content should be replaced with an inline loading skeleton.
-

# File Organization and Naming Conventions

## Example App Structure

```txt
app/
├── layout.tsx
├── layout.stores.ts
├── layout.actions.ts
├── layout.types.ts
│
├── (auth)/
│   ├── layout.tsx
│   └── login/
│       ├── page.tsx
│       ├── page.hooks.tsx
│       └── page.types.ts
│
├── (dashboard)/
│   ├── layout.tsx
│   ├── layout.stores.ts
│   ├── page.tsx
│   ├── page.hooks.tsx
│   │
│   └── analytics/
│       ├── page.tsx
│       ├── page.stores.ts
│       └── page.hooks.tsx
│
└── [username]/
    ├── page.tsx
    ├── page.actions.ts
    ├── page.types.ts
    │
    └── edit/
        ├── page.tsx
        ├── page.stores.ts
        └── page.hooks.tsx
```

## Utility File Placement Strategy

**Shared functionality → Higher in tree:**

- Auth state → `app/layout.stores.ts` (used everywhere)
- User profile actions → `app/layout.actions.ts` (used in multiple places)
- Theme state → `app/layout.stores.ts` (global)

**Section-specific → Middle level:**

- Dashboard sidebar → `app/dashboard/layout.stores.ts` (all dashboard pages)
- Admin permissions → `app/(admin)/layout.stores.ts` (all admin pages)

**Page-specific → Same directory:**

- Chart data → `app/analytics/page.stores.ts` (only analytics page)
- Form state → `app/contact/page.stores.ts` (only contact page)

## Next.js Routing Patterns

**page.tsx creates routes:**

- `/dashboard` → `app/dashboard/page.tsx`
- `/` → `app/page.tsx`
- `/users/alice` → `app/users/[username]/page.tsx`

**Route Groups (parentheses) organize without affecting URL:**

- `app/(auth)/login/page.tsx` → URL: `/login` (NOT `/auth/login`)
- `app/(dashboard)/page.tsx` → URL: `/` (root page with both `app/layout.tsx` and `app/(dashboard)/layout.tsx` applied)
- Use for: grouping related pages that share a layout

**Dynamic Routes [brackets]:**

- `[id]`, `[slug]`, `[username]` for single parameter
- `[...slug]` for catch-all
- `[[...slug]]` for optional catch-all

**Layouts wrap child pages:**

- `app/layout.tsx` wraps entire app (REQUIRED)
- `app/dashboard/layout.tsx` wraps all `/dashboard/*` pages
- Use for: navigation, sidebars, auth checks

# Hook, action, store and type patterns

**Template files:** Refer to the following template files for examples demonstrating each of the utility file types:

- `docs/template_files/template.types.ts`
- `docs/template_files/template.actions.ts`
- `docs/template_files/template.hooks.tsx`
- `docs/template_files/template.stores.ts`

## Types (`*.types.ts`)

- Export all types, constructed from generated Supabase types (`@/supabase/types`)
- **Shared types** → `layout.types.ts` (User, AuthState, global entities)
- **Page-specific types** → `page.types.ts` (form inputs, page-specific entities)

## Actions (`*.actions.ts`)

- Use Supabase **server client** (publishable key) for database table queries (INSERT, DELETE, UPDATE, SELECT)
- Always validate auth with `auth.getUser()` before queries
- Called actions exclusively from React Query hooks
- Function naming: `featureNameAction` (e.g., `loginAction`, `getUserProfileAction`)

## The service role key never touches user-facing code

**The service role client (`supabaseAdmin`, `@/supabase/admin-client`) must not be used anywhere reachable by user interaction. No Server Action, no Route Handler serving the app, no client component, no hook.** It belongs to the worker, to `scripts/`, and to migrations.

A Server Action is a public HTTP endpoint. Anyone can call it with any arguments, so row-level security is the only real authorization boundary the app has. Reaching for the service role switches that boundary off and replaces it with whatever checks happen to be written in that one function — checks the next caller will not know to repeat, and which no policy will enforce on their behalf.

- **Authorization belongs in a policy, not in TypeScript.** If an action needs data the RLS-bound client cannot see, the missing piece is a policy. Write the policy.
- Scope the policy to the narrowest true condition rather than opening the table. `stream_greetings` is readable while its broadcast is live and closed the moment it ends — that is the shape to copy.
- **The one legitimate exception is verifying a secret**, such as the overlay `?token=`, because comparing a stored secret is something RLS cannot express. Keep the exception to the comparison itself: verify the token with the service role, then read the data with the ordinary client.
- An action that writes on behalf of nobody (an overlay marking a card as shown) is not an exception. It still needs to prove it may write, and the proof belongs in a policy.
- Never "temporarily" use the service role to get past a policy error while developing. That is how every one of these gets written.

**Known debt:** this rule is newer than most of the code. Around 170 service-role call sites remain across the action files, and they are being migrated, not grandfathered. Do not add to them.

## Error handling in actions

Next.js strips thrown Server Action error messages in production (the client only gets a generic 500 + digest). So errors are split by kind:

- **Expected errors** (validation, auth, permission, not-found, business rules) → **return** them as a value, never throw. Use the shared `ActionResult<T> = { data: T } | { error: string }` type (in `app/layout.types.ts`). The `error` string is user-facing — write it as a clear message; the message survives to the client in production.
- **Unexpected errors** (DB/storage/infra failures, bugs) → **throw** after `console.error`. These are correctly masked in production and surface a generic toast; details stay in the server log.
- **Mutation hooks unwrap** the result so the existing `onError → toast` plumbing is unchanged:

  ```ts
  mutationFn: async (vars) => {
    const res = await someAction(vars);
    if ("error" in res) throw new Error(res.error);
    return res.data;
  },
  ```

- **Query actions** keep throwing (their failures are unexpected and aren't surfaced as toasts); expected absence is data (return `null`/`[]`).
- **Browser-client operations** (`supabase.auth.*`) are not Server Actions and aren't masked — throw as usual.

## Hooks (`*.hooks.tsx`)

- Use React Query (`useQuery`, `useMutation`) to call actions (refer to `docs/react-query.guide.md` for implementation details)
- Use Supabase **browser client** (publishable key) for auth operations (`auth.signIn`, `auth.signOut`, etc.) and real-time subscriptions
- Update zustand stores (if appropriate) in `onSuccess` callbacks of useMutation hooks, or in the `queryFn` of useQuery hooks.
- Manage loading and error states via react-query hooks (NOT the store)
- Function naming: `useFeatureName` (e.g., `useUserAuth`, `useProductList`)

## Stores (`*.stores.ts`)

- Use Zustand for data requiring direct client management beyond React Query
- Never use `persist` for sensitive user data (email, etc.)
- Function naming: `useFeatureNameStore` (e.g., `useAuthStore`, `useSidebarStore`)
- File naming: **plural** `page.stores.ts` (NOT singular `page.store.ts`)

# Supabase CLI

This project uses a remote Supabase repository. There is no local database.

## Create migrations:

`npx supabase migration new [migration name]`
(do not create migration files manually)

## Push migrations:

`npx supabase db push`

## Query the database:

In order to query the database, create and run a custom typescript script. (Do not use `psql`)

## Generate types:

`npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`

# Spec & task governance

How OpenSpec changes and deferred work are managed. These rules exist to prevent process poisoning (incomplete active changes being treated as a mandate and re-implemented, causing regressions) and corner-cutting, and to keep each spec small, specific, and unambiguous so its tasks pin down exactly what will be done and how. Follow them exactly.

1. **Active changes are build-now-only.** An active OpenSpec change contains only tasks that will be implemented in code in the current cycle. Never leave "manual verification," "legal review," "blocked on external," or "future enhancement" tasks as unchecked boxes in an active change.
2. **Non-code work leaves the change.** The moment a task cannot be finished in code (needs live data, user sign-off, an external key, or it is a future idea), move it to a **Linear issue** and remove it from `tasks.md`. Do not leave it unchecked.
3. **Archive when code-complete + verified.** Run `openspec-verify-change` before archiving. Never leave a change active with lingering unchecked tasks — that lingering is the poisoning vector.
4. **Linear is the idea-channel, never the build-channel.** Never implement directly from a Linear issue. To build a backlog item, first promote it into a **new** OpenSpec change (spec → plan → implement).
5. **No silent checking.** Check a task box only with evidence the work is actually done. "Done but unverifiable right now" becomes a Linear verification issue — never a checked box.
6. **Specs are small and specific.** Keep each change narrow — one coherent piece of work, not a grab-bag. Every task must describe exactly *what* will be done and *how* it will be done (which file, which function, which behavior), so there is no room to improvise or take shortcuts at implementation time. A task a reader could satisfy two different ways is underspecified — tighten it.
7. **Resolve ambiguity before writing, through discussion.** When anything about a spec is unclear or could be read more than one way, stop and discuss it with the user until it is settled — never paper over it with a vague task or a guessed assumption. Ambiguity is resolved in the spec, not deferred to implementation.


**Backlog location:** Linear, Gazzola (personal) workspace, **"Az"** team, **"Vids.Tube"** project. Read open issues there before starting deferred work.

# Email Template Development

Supabase Auth transactional emails are built with [React Email](https://react.email). Source components live in `emails/` and use the light-mode design tokens from `app/globals.css` (mapped to email-safe hex in `emails/_theme.ts`, since email clients don't support OKLCH). Supabase template variables (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`) are written as literal strings inside the components and survive rendering.

Templates: `confirmation`, `recovery`, `invite`, `magic_link`, `email_change`.

## Preview

```bash
npm run email:dev   # react-email dev server at http://localhost:3000
```

## Build (compile to HTML)

```bash
npm run email:build   # renders emails/*.tsx -> supabase/templates/*.html
```

## Deploy to Supabase

Template subject + `content_path` live in `config.toml` (`[auth.email.template.*]`) and deploy via the config sync system below — `npm run email:build` first, then `config:push`. SMTP (Resend) is configured in the Supabase Dashboard, not in this repo.

# Runbooks

Durable operational guides live in `docs/runbooks/`. Read the relevant one before
changing anything it covers, and update it when the behaviour it describes changes.

- **[docs/runbooks/maintenance-runner.md](docs/runbooks/maintenance-runner.md)** — the always-on machine that settles finished broadcasts. **Setting this repo up on a new machine to run maintenance starts here.** Turn it on with `npm run maintain:install`, once.
- **[docs/runbooks/next-broadcast-checklist.md](docs/runbooks/next-broadcast-checklist.md)** — what to verify during the next live broadcast, and which tickets are chosen to build on stream.
- **[docs/runbooks/live-streaming-vm.md](docs/runbooks/live-streaming-vm.md)** — the streaming machine: MediaMTX, the quality ladder, recording and VOD finalize.

Two rules that keep costing time when forgotten:

- **The live worker (`npm run worker`) engages broadcasts and nothing else.** It does not settle a finished one. Stopping it the moment a stream ends is correct and loses nothing.
- **Tool paths are found, not configured.** `worker/lib/resolve-bin.ts` resolves the Claude CLI, ffmpeg and whisper by trying the configured value, the same path under the current user's home, then the usual install locations. Never edit a Doppler path to make a tool resolve: those values are shared across machines and user accounts, so fixing one account breaks another.

# Supabase config sync

The Management API is the real interface (the CLI and Dashboard are clients of it). `SUPABASE_ACCESS_TOKEN` lives in Doppler (`dev_personal` config) — it is an **account-wide** token, treat it like a root credential.

There is no `supabase config pull`, and native `supabase config push` is all-or-nothing — it would overwrite the *entire* remote auth block with the stock local `config.toml` (reset `site_url` to `127.0.0.1`, turn confirmations off, drop SMTP). **Never run native `config push`.** Instead we sync an explicit set of managed fields via the Management API, with `config.toml` as desired state and `config.toml.remote` as observed state:

```bash
doppler run -- npm run config:pull        # read remote -> .remote-config.json + config.toml.remote
doppler run -- npm run config:diff        # desired (config.toml) vs observed; non-zero on drift
doppler run -- npm run config:push        # dry run: show what would change
doppler run -- npm run config:push:apply  # apply managed fields only, then verify read-back
```

Managed fields are declared in `supabase/config-managed.ts` (currently the auth slice: site_url, redirect URLs, confirmations, SMTP sender name/email, the 5 email templates). Golden rule: **one writer per setting** — a managed field is owned by `config.toml`; don't also edit it in the Dashboard. Full details and the change/reconcile workflows: [docs/supabase-config-sync.md](docs/supabase-config-sync.md).

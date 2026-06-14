# Email + Supabase config-sync — porting kit

Transplants two self-contained subsystems from vids.tube into another repo:

1. **Email templates** — React Email components compiled to HTML for Supabase Auth emails.
2. **Config sync** — pull/diff/push Supabase auth config (incl. SMTP + templates) via the Management API, with `config.toml` as the source of truth.

They are independent — you can take just one. They couple only through `config.toml`
(`content_path` → `supabase/templates/*.html`).

This kit assumes the target uses **Doppler** for secrets (scripts keep the `doppler run --`
prefix) and **Resend** for SMTP, same as the source.

---

## Fastest path (Claude in the target repo)

Open a Claude session in the target repo and give it this:

> Read `c:\Users\azgaz\Documents\Projects\Vids.Tube\docs\porting\email-supabase-kit\INSTALL.md`
> and apply it to this repo. Use the absolute source paths it references.

Claude follows the steps below. Otherwise do them by hand.

---

## What moves

### Email kit
- Files: `files/emails/*` → target `emails/` (8 files: `_theme.ts`, `_layout.tsx`, the 5
  templates, `render.tsx`).
- Output dir: `supabase/templates/` (created by the build).
- Deps: `@react-email/components`, `react`, `react-dom` (runtime) + `react-email`, `tsx` (dev).
- Scripts:
  - `"email:dev": "react-email dev --dir emails"`
  - `"email:build": "tsx emails/render.tsx"`

### Config-sync kit
- Files: `files/supabase/*` → target `supabase/` (`config-api.ts`, `config-managed.ts`,
  `config-pull.ts`, `config-diff.ts`, `config-push.ts`, `resend-check.ts`).
  Only depends on `fetch` + node built-ins.
- Deps: `tsx` (dev) only.
- Scripts:
  - `"config:pull": "tsx supabase/config-pull.ts"`
  - `"config:diff": "tsx supabase/config-diff.ts"`
  - `"config:push": "tsx supabase/config-push.ts"`
  - `"config:push:apply": "tsx supabase/config-push.ts --apply"`
  - `"email:check": "tsx supabase/resend-check.ts"`

> Run scripts via Doppler, e.g. `doppler run -- npm run config:pull`. Add the `doppler run --`
> prefix to the package.json scripts if that's your convention, or prefix at call time.

---

## Steps

1. **Copy files** verbatim from `files/emails/*` and `files/supabase/*` into the target's
   `emails/` and `supabase/` dirs.

2. **Merge deps + scripts** into the target `package.json` (lists above). If it's not already
   ESM-friendly, no change needed — `tsx` runs the `import.meta.url` scripts fine regardless of
   `"type"`.

3. **config.toml** — the scripts read `supabase/config.toml` (standard Supabase CLI location).
   Merge the `[auth]` block from `config.toml.auth-block.example` into it, replacing every
   `{{PLACEHOLDER}}`. These are the only fields the kit manages; leave the rest of the stock
   config alone. **Never run native `supabase config push`** — it's all-or-nothing and would
   overwrite the whole remote auth block. Use this kit's `config:push` instead.

4. **Adapt 3 project-specific spots:**
   - `supabase/config-api.ts` — change the hardcoded `PROJECT_REF` fallback to the target's
     project ref, or rely on `SUPABASE_PROJECT_REF` env and drop the literal default.
   - `emails/_theme.ts` — set `appName` and the brand colors (email-safe hex; no OKLCH).
   - `config.toml` `[auth]` block — site_url, redirect URLs, `sender_name`, `admin_email`,
     subjects (done in step 3).

5. **gitignore** the generated artifacts (add to target `.gitignore`):
   ```
   supabase/.remote-config.json
   supabase/config.toml.remote
   supabase/templates/
   ```
   `config.toml` is the only committed source of truth; templates are rebuilt from `emails/`.

6. **Secrets** (Doppler config for the target):
   - `SUPABASE_ACCESS_TOKEN` — account-wide Management API token
     (https://supabase.com/dashboard/account/tokens). Treat as a root credential.
   - `RESEND_API_KEY` — a Resend **sending** key (least privilege). Used as `smtp_pass` and by
     `email:check`. The `admin_email` from-domain must be a **verified** domain in that Resend
     account.
   - Optionally `SUPABASE_PROJECT_REF` instead of editing the literal in `config-api.ts`.

---

## Verify the port

```bash
npm run email:build                          # renders emails/*.tsx -> supabase/templates/*.html
doppler run -- npm run email:check           # lists Resend domains; confirms from-domain is verified
doppler run -- npm run config:pull           # reads live remote (read-only)
doppler run -- npm run config:diff           # desired vs observed
doppler run -- npm run config:push           # DRY RUN — review the diff
doppler run -- npm run config:push:apply     # apply managed fields, then verify read-back
doppler run -- npm run config:pull           # refresh, expect PARITY on next diff
```

`email:check` 401 = sending-only key (expected; domain listing needs full-access). If it lists
your verified domain another way, you're fine.

---

## Notes / gotchas

- **One writer per setting.** A managed field is owned by `config.toml`. If someone also edits it
  in the Supabase Dashboard, the next `config:diff` flags drift — fix it in `config.toml`.
- **Secrets are write-only.** `config:pull`/`diff` can't read `smtp_pass` back; `config:push`
  resolves `env(RESEND_API_KEY)` at push time. An unset env value is omitted from the patch, so it
  never clobbers the remote.
- **Adding a managed field later:** add one entry to `supabase/config-managed.ts` — every command
  picks it up.
- Full background on the design lives in the source repo at `docs/supabase-config-sync.md`.

---

## Toward the formalized system (later)

This `files/` tree is a point-in-time snapshot. When you formalize it, the natural next step is a
Claude Code skill or a `degit`-style template that (a) copies `files/`, (b) prompts for the 3
adaptations + secrets, (c) merges package.json scripts, and (d) runs the verify block. The manifest
in "What moves" is already the skill's spec.

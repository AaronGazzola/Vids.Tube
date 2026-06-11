## Context

Signup currently runs entirely in the browser hook (`app/layout.hooks.tsx`):
`supabase.auth.signUp` with `pending_handle` metadata, then branches on the
error message. With email confirmation ON (`mailer_autoconfirm = false`),
GoTrue deliberately returns a sanitized success (no error) for an already-
registered email to prevent enumeration — so the `"already registered"` branch
is dead code, and an existing-confirmed user gets a misleading "Account created"
toast with no email actually sent (AZ-55).

Handles are reserved atomically by the `reserve_handle_on_signup` trigger on
`auth.users` insert; abandoned unconfirmed signups are reaped after 1h by a
`pg_cron` job, freeing the handle. `@handle` availability is checked in real time
via `checkHandleAvailabilityAction` against the public-read `channels` table. The
repo already has `supabase/admin-client.ts` (service-role) and React Email
templates for `confirmation` and `magic_link`.

## Goals / Non-Goals

**Goals:**
- One enumeration-safe signup path: identical user-facing response in all cases.
- Send an email in every case; the email itself carries new-vs-existing.
- Keep the existence/confirmation check server-side only.
- Use only standard Supabase methods (`auth.signUp`, `auth.signInWithOtp`,
  `auth.admin`) and existing email templates — no new migration, no new tables.

**Non-Goals:**
- Disclosing "email already taken" in the UI (rejected: re-introduces
  enumeration). The disclose-vs-protect toggle for future client templates is
  out of scope here.
- Changing the `@handle` availability check or the `reserve_handle_on_signup`
  trigger / cleanup cron.
- Custom email content beyond the existing `confirmation` and `magic_link`
  templates.

## Decisions

### D1: Move signup into a server action; keep the existence check server-side
The hook calls a new `signUpAction(email, password, handle, origin)` in
`app/layout.actions.ts`. The action calls a `SECURITY DEFINER` SQL function
`email_signup_status(email)` (via the admin/service-role client) that returns
`'none' | 'unconfirmed' | 'confirmed'`, then picks the branch. Because this runs
on the server, the existence signal never reaches the browser — that is what
makes the flow enumeration-safe. The hook receives only `{ success: true }`.

*Why a SQL function, not the admin SDK:* `supabase-js`'s `auth.admin` exposes
only `getUserById` and paginated `listUsers` — there is no lookup-by-email and no
filter. Paginating all users to find one email does not scale. A `SECURITY
DEFINER` function querying `auth.users.email` is the canonical, indexed, scalable
lookup, and is the same mechanism the existing `reserve_handle_on_signup` trigger
uses. It is locked down (`revoke ... from public, anon, authenticated`) so only
the service-role can call it — the browser cannot enumerate through it.

*Alternative considered:* keep it in the browser hook and read `identities` on
the raw response. Rejected — the SDK collapses `data.user` to `null` for
confirmation-required signups (so `identities` is unreadable), and any
client-visible branch is an enumeration vector.

*Alternative considered:* probe with `signInWithOtp({ shouldCreateUser: false })`
and branch on its error to avoid a migration. Rejected — relies on undocumented
obfuscation behavior of the OTP endpoint; too fragile for a reusable template.

### D2: Branch by account state
- **No user** → `supabase.auth.signUp({ email, password, options: { data: {
  pending_handle: handle }, emailRedirectTo: <callback> }})`. Creates the
  unconfirmed user, fires the handle-reservation trigger, sends the
  `confirmation` template. The confirm link establishes a session via
  `/auth/callback`.
- **User exists, unconfirmed** → resend the confirmation email
  (`supabase.auth.resend({ type: "signup", email })`), no new account.
- **User exists, confirmed** → `supabase.auth.signInWithOtp({ email, options: {
  shouldCreateUser: false, emailRedirectTo: <callback> }})`. Sends the
  `magic_link` template; the link signs them in. `shouldCreateUser: false`
  guarantees this path can never mint a new (passwordless, handle-less) account —
  new accounts are born only through `signUp`.

*Alternative considered:* `admin.generateLink`. Rejected for the send step —
`generateLink` returns a link but does not itself send the email, whereas
`signUp` / `resend` / `signInWithOtp` send via the configured Resend SMTP using
the existing templates. We keep the admin client only for the read (lookup).

### D3: Single success outcome in the hook
`signUp` mutation `onSuccess` shows one "Check your email" toast and routes to
`/verify`. Remove the `needsVerification` toast variant, the `"already
registered"` resend branch, and the `"Database error saving new user"` message
branch. A genuine handle race (trigger raises on unique violation during the
new-user `signUp`) surfaces as the action's expected `ActionResult` error and is
the only case that shows an error toast — it does not reveal email existence.

## Risks / Trade-offs

- **A returning, confirmed user who fat-fingers signup gets a magic-link email,
  not a password prompt, and any different `@handle` they typed is silently
  ignored.** → Acceptable and inherent to the secure flow: the form cannot reveal
  "you already have an account." They still end up signed in from the email.
- **Admin lookup adds a service-role call on every signup.** → Single indexed
  lookup by email; negligible. Keeps secrets server-side (action only).
- **`signInWithOtp` for a confirmed user is a sign-in, not a "confirm" action.**
  → Correct: confirmed users have nothing to confirm; the spec's "confirm if not
  already done, sign in either way" reduces to a magic link for this case.
- **No enumeration in the response, but timing/rate differences could leak.** →
  Out of scope for MVP; Supabase's built-in CAPTCHA + auth rate limiting are the
  standard mitigation and can be enabled later.

## Migration Plan

One small idempotent migration adds the `email_signup_status` `SECURITY DEFINER`
function and revokes execute from `public`/`anon`/`authenticated`. Push it
(`npx supabase db push`), then ship the action + hook changes together; verify
via typecheck/lint/build and a manual run of all three cases (new, unconfirmed,
confirmed) against the remote project with confirmation ON. Rollback is reverting
the hook/action commit and `drop function public.email_signup_status(text)`.

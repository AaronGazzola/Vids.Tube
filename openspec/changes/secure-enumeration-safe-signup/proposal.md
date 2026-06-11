## Why

Signing up with an email that already has an account currently shows a misleading "Account created — check your email" message (no email is sent for an already-confirmed user), because with email confirmation ON, Supabase deliberately returns a sanitized success with no error to prevent email enumeration — so the existing client-side error branches are dead code (AZ-55). Rather than re-introduce enumeration by disclosing "that email is taken," we adopt the OWASP-aligned, Supabase-default secure flow: an identical user-facing response in every case, with the difference carried only over the email channel.

## What Changes

- **BREAKING (behavior):** Signup no longer distinguishes outcomes in the UI. The form always shows a single "Check your email" message and routes to `/verify`, regardless of whether the email is new, unconfirmed, or already registered. No "account already exists" or "verification resent" messaging is shown.
- Move the signup call out of the browser hook into a **server action** so the existence check stays server-side and never leaks to the client.
- Add a small `SECURITY DEFINER` SQL function `email_signup_status(email)` (locked to the service-role) so the server can tell whether the email is a new, unconfirmed, or confirmed account without exposing `auth.users` — the admin SDK has no lookup-by-email. The server action picks the branch from its result (via `supabase/admin-client.ts`):
  - **New / existing-unconfirmed email** → `auth.signUp` (sends the existing `confirmation` template, captures `pending_handle` + password; confirm link signs them in via `/auth/callback`).
  - **Existing + confirmed email** → `auth.signInWithOtp` with `shouldCreateUser: false` (sends the existing `magic_link` template; link signs them in).
- The action **always returns success**; the hook's `onSuccess` reduces to one "check your email" toast and a `/verify` redirect.
- **Remove** the dead fallback branches in `app/layout.hooks.tsx`: the `"already registered"` resend path (and its `needsVerification` toast variant) and the `"Database error saving new user"` handle message driving UX.
- **Unchanged:** the `reserve_handle_on_signup` trigger (only fires for genuinely new users) and the real-time `@handle` availability check.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `auth`: The "Account signup" requirement changes from disclosing duplicate-email outcomes (success vs. "resent" toast) to a single enumeration-safe response in all cases, with new-vs-existing handled only via which email is sent. Adds the requirement that the existence/confirmed check runs server-side via a server action using the admin client.

## Impact

- **Code:** `app/layout.hooks.tsx` (signUp mutation simplified), new server action in `app/layout.actions.ts`, `app/(auth)/signup/page.tsx` (unchanged contract, simplified outcome).
- **Supabase:** uses standard `auth.signUp`, `auth.resend`, and `auth.signInWithOtp` methods plus one new `SECURITY DEFINER` SQL function (`email_signup_status`) called via the existing `supabase/admin-client.ts`; relies on existing `confirmation` and `magic_link` email templates in `emails/`. Confirmation stays ON (`mailer_autoconfirm = false`). One small idempotent migration adds the function; the `reserve_handle_on_signup` trigger is untouched.
- **Security:** removes the misleading success; closes the enumeration vector by keeping the existence check server-side. OWASP-aligned. Establishes a reusable pattern for client templates where disclose-vs-protect could later be a config toggle.
- **Linear:** resolves AZ-55.

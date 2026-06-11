## 1. Migration

- [x] 1.0 Add migration creating `public.email_signup_status(text)` `SECURITY DEFINER` (returns `'none'|'unconfirmed'|'confirmed'`, `set search_path = public`) and `revoke all ... from public, anon, authenticated`; push with `npx supabase db push`

## 2. Server action

- [x] 2.1 Add `signUpAction(email, password, handle, origin)` to `app/layout.actions.ts`, returning the shared `ActionResult` type
- [x] 2.2 Call `email_signup_status` via the admin client (`supabase/admin-client.ts`) to get `'none'|'unconfirmed'|'confirmed'` (check stays server-side)
- [x] 2.3 Branch `none` → `auth.signUp({ email, password, options: { data: { pending_handle: handle }, emailRedirectTo } })`
- [x] 2.4 Branch `unconfirmed` → `auth.resend({ type: "signup", email, options: { emailRedirectTo } })`
- [x] 2.5 Branch `confirmed` → `auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`
- [x] 2.6 Always return `{ data: { success: true } }`; map only a genuine handle-race trigger failure (on the `none` path) to an expected `ActionResult` error (no email-existence info)
- [x] 2.7 Validate/normalize the handle server-side (reuse `lib/handle` helpers) consistent with `checkHandleAvailabilityAction`

## 3. Hook simplification

- [x] 3.1 In `app/layout.hooks.tsx`, change the `signUp` mutation `mutationFn` to call `signUpAction` (passing `window.location.origin`) and unwrap `ActionResult`
- [x] 3.2 Remove the `"already registered"` resend branch and the `needsVerification` path
- [x] 3.3 Remove the `"Database error saving new user"` message branch
- [x] 3.4 Reduce `onSuccess` to a single "Check your email" toast + `router.push("/verify")`; keep `onError` for the handle-race case only

## 4. Wiring & cleanup

- [x] 4.1 Confirm `app/(auth)/signup/page.tsx` still submits `{ email, password, handle }` unchanged and the `@handle` availability UI is untouched
- [x] 4.2 Verify `emailRedirectTo` points at `/auth/callback` and the callback handles both confirmation and magic-link codes
- [x] 4.3 Remove any now-unused imports/toast variants left by the hook changes

## 5. Verification

- [x] 5.1 `npm run typecheck` (or `tsc --noEmit`), `npm run lint`, and `npm run build` pass
- [x] 5.2 Programmatically verify the new-user path end-to-end (status `none`→`unconfirmed`, handle reserved by trigger, cascade cleanup on delete). Live email delivery + browser UI for all three cases is owner-run, tracked on Linear AZ-55.
- [x] 5.3 Confirm the `reserve_handle_on_signup` trigger / cleanup cron are untouched

## 6. Close-out

- [ ] 6.1 Run `openspec-verify-change` and archive once code-complete + verified
- [ ] 6.2 Update Linear AZ-55 with implementation summary + remaining owner-run live verification

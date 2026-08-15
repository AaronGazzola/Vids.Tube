# Tasks

## 1. Schema

- [x] 1.1 `npx supabase migration new add_overlay_settings`, adding `settings_fields jsonb not null
      default '[]'::jsonb` to `public.overlays` and `settings jsonb not null default '{}'::jsonb` to
      `public.channel_overlays`, with column comments saying the host stores these and never interprets
      them.
- [x] 1.2 `npx supabase db push`, then regenerate `supabase/types.ts`. Applied 15-Aug-2026.

## 2. The declaration and its rules

- [x] 2.1 `lib/overlay-settings.ts`: `OverlaySettingsField` and `OverlaySettingsValue` types, and
      `parseSettingsFields(value)` returning a validated field list from unknown jsonb, dropping a
      malformed entry rather than throwing so one bad row cannot take the panel down for a streamer who
      did not write it. Also `parseSettingsValues` for the stored side.
- [x] 2.2 Same file: `resolveSettings(fields, stored)` returning stored values with declared defaults
      filled in for anything unset.
- [x] 2.3 Same file: `validateSettingsWrite(fields, incoming, stored)` returning either the accepted
      object or a reason. Rejects an undeclared key, a value of the wrong type, a number outside a
      declared range or off a declared step, a choice outside its options, and text over 500 characters.
      Carries forward an already-stored value whose key is no longer declared.
- [x] 2.4 `tests/unit/overlay-settings.test.ts`: 19 cases, all passing. A malformed declaration entry is
      dropped and the rest survive; a duplicate key does not let the second win; a choice with no options
      is dropped; defaults fill unset fields; a declared field with no default is left absent rather than
      invented; an undeclared key, an out-of-range number, an off-step number, a bad choice and a wrong
      type are each refused; a finite number with no declared range is stored; a stored value for a
      withdrawn field survives a later write.

      One case earns its place: a slider at 0.7 with a step of 0.1 lands a hair off a whole number of
      steps in floating point, and a strict step check would refuse the editor's own output.

## 3. Reading and writing

- [x] 3.1 `app/(app)/live/overlay.actions.ts`: `getOverlaySettingsAction(overlayId)` returning
      `{ fields, values }` for the owner's channel, and `saveOverlaySettingsAction(overlayId, values)`
      running `validateSettingsWrite` and returning its reason on refusal. Both behind the existing
      owner check.
- [x] 3.2 `lib/overlay-cors.ts`: the cross-origin headers extracted from the token route so both
      endpoints share one definition, with `authorization` added to the allowed headers, plus
      `bearerToken(request)`. The token route's behaviour is unchanged.
- [x] 3.3 `app/api/overlay/settings/route.ts`: a `GET` reading `Authorization: Bearer <token>`, verifying
      it the way the exchange endpoint does, and returning the resolved settings of the installation the
      token names. One refusal for every failure, and an `OPTIONS` handler for the preflight.

## 4. The editor

- [x] 4.1 `components/overlay/settings-field.tsx`: one input per declared type. A number with a range
      draws a slider showing its value, a number without one draws a number input, a toggle draws the
      existing `Switch`, a choice draws a select, a colour reuses `colour-picker.tsx`, text draws an
      input.
- [x] 4.2 `app/(app)/live/overlay-registry.hooks.tsx`: `useOverlaySettings(overlayId)` and
      `useSaveOverlaySettings(overlayId)` invalidating it, with the existing error toast.
- [x] 4.3 `app/(app)/live/overlay-settings-panel.tsx`, mounted under an installed overlay in the install
      list: an inline skeleton while loading, an empty state where the overlay declares no fields, and a
      note that a saved change reaches the stream when the browser source reloads.
- [x] 4.4 The save is explicit rather than on every keystroke, so a slider being dragged writes once.

## 5. Verify

- [x] 5.1 Folded into `scripts/check-overlay-registry-rls.ts` rather than a second script, because
      settings live on tables it already probes. Ten checks, all passing; the two new ones are that
      another channel's settings are invisible signed out, and that a signed-out rewrite updates no rows.
- [x] 5.2 `tests/e2e/overlay-settings.spec.ts`: five cases, all passing. A valid token reads the
      installation's settings with declared defaults filled in; a missing, malformed, expired and forged
      token are refused identically; a token naming another installation is refused; the preflight allows
      the framed origin and the authorization header.
- [x] 5.3 `npx tsc --noEmit` clean, `npx eslint` clean over every changed file, 636 unit tests pass
      across 53 files, `npm run build:local` completes, and the game-window and token-exchange specs
      still pass.
- [x] 5.4 Covered by a real signed-in run rather than by hand: the owner logs in, opens the Overlays tab,
      flips a declared toggle, saves, and the framed overlay reads the new value back through the
      endpoint. Editor and endpoint agree on one stored object.

      The first version of this test failed for a reason worth recording: `/live` has its own Save and
      Discard buttons for discarding a broadcast, so a page-wide locator matched those instead. The
      panel now carries a test id and the test is scoped to it.

# Tasks

## 1. Schema

- [ ] 1.1 `npx supabase migration new add_overlay_registry`, creating `public.overlays` with
      `id uuid primary key default gen_random_uuid()`, `slug text not null unique check (slug =
      lower(slug) and slug ~ '^[a-z0-9-]+$')`, `name text not null`, `owner_user_id uuid references
      auth.users (id) on delete set null`, `entry_url text not null`, `status text not null default
      'draft' check (status in ('draft','published','disabled'))`, `created_at`, `updated_at`.
- [ ] 1.2 Same migration: `public.channel_overlays` with `id uuid primary key default gen_random_uuid()`,
      `channel_id uuid not null references public.channels (id) on delete cascade`, `overlay_id uuid not
      null references public.overlays (id) on delete cascade`, `enabled boolean not null default true`,
      `created_at`, and `unique (channel_id, overlay_id)`.
- [ ] 1.3 Same migration: enable row level security on both tables. `overlays` gets a select policy
      `using (status = 'published')`. `channel_overlays` gets select, insert, update and delete policies
      gated on `exists (select 1 from public.channels c where c.id = channel_overlays.channel_id and
      c.owner_user_id = auth.uid())`, matching the `command_events` pattern.
- [ ] 1.4 `npx supabase db push`, then regenerate `supabase/types.ts` with `npx supabase gen types
      typescript --project-id <project-ref>`.
- [ ] 1.5 `scripts/check-overlay-registry-rls.ts`: with an anon client, assert a `draft` overlay row is
      not readable, a `published` row is, and another account's `channel_overlays` row is not readable
      or writable. Run it and record the output in the change.

## 2. Seed the first overlay

- [ ] 2.1 `scripts/seed-dragon-overlay.ts`: read `NEXT_PUBLIC_GAME_EMBED_URL`, throw when absent, and
      upsert an `overlays` row on `slug = 'dragon'` with that value as `entry_url`, name `Dragon`,
      `owner_user_id` null and status `published`.
- [ ] 2.2 Same script: install it on the owner's channel by upserting `channel_overlays` on
      `(channel_id, overlay_id)`, so re-running the script changes nothing.
- [ ] 2.3 Run the script against the remote database and confirm one registry row and one installation
      exist, reporting counts rather than ids.

## 3. Reading the installation

- [ ] 3.1 `app/(overlay)/overlay/[channelSlug]/page.actions.ts`: add
      `getInstalledOverlayAction(channelSlug, token)`, resolving the channel by slug through
      `supabaseAdmin`, rejecting a token that does not match `overlay_layouts.token` exactly as
      `getOverlayLayoutAction` does, and returning `{ installId, entryUrl } | null` for the single
      enabled installation whose overlay status is `published`.
- [ ] 3.2 `app/(overlay)/overlay/[channelSlug]/page.hooks.tsx`: add `useInstalledOverlay(channelSlug,
      token)` calling that action, on the same 15 s `refetchInterval` the layout uses.
- [ ] 3.3 `app/(app)/live/overlay.actions.ts`: add `listChannelOverlaysAction()` returning every
      `published` overlay with a flag for whether the owner's channel has it installed, and
      `installOverlayAction(overlayId)` / `removeOverlayAction(overlayId)`, all resolving the channel
      through the existing `getOwnedChannelId` owner check.

## 4. Framing the installation

- [ ] 4.1 `lib/overlay-frame.ts`: add `framedOverlayUrl(entryUrl, installId, permittedOrigin)` returning
      the entry address with `install=<installId>` appended to its existing query, or `null` when
      `entryUrl` is unparseable or its origin differs from `permittedOrigin`. The existing query and
      fragment are preserved byte for byte.
- [ ] 4.2 `tests/unit/overlay-frame.test.ts`: assert the appended parameter joins an existing query
      rather than replacing it, that an existing fragment survives, that a foreign origin returns null,
      and that an unparseable address returns null.
- [ ] 4.3 `components/overlay/game-window.tsx`: take `installation: { installId, entryUrl } | null` as a
      prop instead of reading `process.env.NEXT_PUBLIC_GAME_EMBED_URL` for the address. Read the
      environment value only for the permitted origin, pass both to `framedOverlayUrl`, render nothing
      and `console.error` on null, and keep the placeholder branch for the composer unchanged.
- [ ] 4.4 `components/overlay/overlay-stage.types.ts` and `overlay-stage.tsx`: carry the installation on
      `values`, and pass it to `GameWindow`.
- [ ] 4.5 Supply the installation from every caller of `OverlayStage`: the OBS route from
      `useInstalledOverlay`, and the popout route, the Overlays tab and the composer from the owner-side
      list. A caller with no installation passes null.
- [ ] 4.6 Update `tests/unit/game-window-render.test.tsx` for the prop: no installation renders nothing,
      an installation with the permitted origin renders a frame whose `src` carries `install`, and a
      foreign origin renders nothing.

## 5. The install control

- [ ] 5.1 `app/(app)/live/overlays-tab.hooks.tsx`: add `useChannelOverlays()` over
      `listChannelOverlaysAction`, plus install and remove mutations invalidating that query.
- [ ] 5.2 `app/(app)/live/overlays-tab.tsx`: add an overlay list to the existing control panel, one row
      per published overlay with its name and an install or remove action, showing an inline skeleton in
      place of the list while it loads rather than replacing the panel.
- [ ] 5.3 Same list: mark a row whose entry origin is not the permitted origin as not renderable, using
      `framedOverlayUrl` returning null as the test, so the streamer sees why nothing frames.

## 6. Verify

- [ ] 6.1 `tests/e2e/game-window.spec.ts`: replace the environment-variable skip guard with a check that
      the channel has an installation, and assert the framed `src` carries the `install` parameter.
- [ ] 6.2 Run `npx vitest run` and `npx playwright test tests/e2e/game-window.spec.ts`, and record both
      results in the change.
- [ ] 6.3 Load the overlay route in a browser against the seeded installation and capture the frame
      rendering, confirming the dragon still appears after the address stopped coming from the
      environment.

## 1. State

- [x] 1.1 `app/(app)/live/demo.types.ts`: add `mobileChrome: boolean` to
  `DemoLayoutConfig`, default `false` in `DEFAULT_DEMO_LAYOUT`, back-fill in
  `mergeDemoLayout`
- [x] 1.2 `app/(app)/live/demo.stores.ts`: add `setMobileChrome(v: boolean)` to the
  layout store, updating `config.mobileChrome`
- [x] 1.3 `app/(app)/live/page.tsx`: change the `useDemoLayout(...)` call to
  `useDemoLayout(true)` so the layout config hydrates in both modes (the hook's
  hydrate-once and save-after-hydrate guards make this safe with demo off)

## 2. Chrome component

- [x] 2.1 `components/mobile-chrome.tsx`: reference constants object (all dimensions
  in 1080-wide reference px per design.md, including `CHROME_ABOVE = 96` and
  `CHROME_BELOW = 90`), a fixed invented sample-chat constant list (4 rows + notice),
  and static representative viewer/like counts
- [x] 2.2 Same file: `MobileChromeTopBar({ scale, handle, avatarUrl })` — back arrow,
  avatar (fallback initial when `avatarUrl` null), handle over a live-dot/viewers/likes
  counts row, white Subscribe pill, three-dot glyph, black background, all sized by
  `scale`
- [x] 2.3 Same file: `MobileChromeOverlay({ scale })` — chat rows with avatars, member
  badge chips, handles, message text (white with subtle text-shadow, opacity graduated
  100%→70% bottom-to-top), the welcome-notice line with blue "Learn more", the red
  heart reaction button bottom-right, and the "Chat…" input pill positioned with 25% of
  its height overlapping the video bottom edge; the whole overlay `pointer-events-none`

## 3. Real Preview tab

- [x] 3.1 `components/live-player.tsx`: wrap the `<video>` in a shrink-wrapped
  `relative` div; add optional props
  `mobileChrome?: { handle: string | null; avatarUrl: string | null } | null` and
  `onPortraitChange?: (portrait: boolean | null) => void` (from `loadedmetadata`
  video dimensions, `null` before known); when `mobileChrome` is set and the video is
  portrait, measure the video width with a `ResizeObserver`, add
  `CHROME_ABOVE`/`CHROME_BELOW` scaled padding to the container, and render
  `MobileChromeTopBar` (`absolute bottom-full`) + `MobileChromeOverlay` against the
  video wrapper
- [x] 3.2 `app/(app)/live/page.tsx`: floating Mobile layout chip (label + shadcn
  `Switch`, `bg-black/70` styling per the demo panel) top-right over the real player,
  bound to `config.mobileChrome`/`setMobileChrome`; disabled with a "vertical streams
  only" hint while the reported aspect is landscape; pass `mobileChrome` (channel
  handle + avatar URL) to `LivePlayer` when on

## 4. Demo stage

- [x] 4.1 `app/(app)/live/demo-preview.tsx`: measure the stage with a
  `ResizeObserver`; when `config.mobileChrome` is on, wrap the background + overlay
  layers (not the control panel or slideshow controls) in a single div with
  `transform: scale(k) translateY(dy)` per design.md so the top bar and input fit
  above/below the centered 9:16 video area; render `MobileChromeTopBar` +
  `MobileChromeOverlay` anchored to the scaled video rect
- [x] 4.2 Same file: add a "Mobile layout" `Switch` row to the overlay control panel
  (below the Goals reached row), bound to `config.mobileChrome`/`setMobileChrome`

## 5. Verify

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, `doppler run -- npm run build` clean
- [x] 5.2 `npx openspec validate add-mobile-layout-preview --strict`
- [x] 5.3 Visual check against the reference screenshot: chrome on the demo stage at
  two different window sizes keeps proportional scale/position/opacity; toggling off
  restores the exact prior stage; real-preview switch disabled state shows for a
  landscape source

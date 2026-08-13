## 1. The thumbnail becomes an ordinary field

- [ ] 1.1 Add a staged thumbnail to `SettingsForm` in `app/(app)/live/settings-tab.tsx`,
      holding either the saved key or a newly chosen `File`, so the field carries its own state
      like every other.
- [ ] 1.2 Render the preview from the saved key when unchanged and from a local object URL when
      a file is staged, revoking the object URL when it is replaced or the component unmounts.
- [ ] 1.3 Enforce the existing 5 MB and JPG/PNG/WebP limits at selection, reporting the same
      messages the action reports today, so a bad file is rejected before it is staged.
- [ ] 1.4 Remove the encoder gate and the direct `thumbnail_path` write from
      `uploadBroadcastThumbnailAction` in `app/(app)/live/broadcast.actions.ts`, leaving it to
      upload bytes and return the key.
- [ ] 1.5 In the settings save path, upload a staged file first and write the returned key with
      the rest of the settings in the same save, so nothing reaches storage until save.
- [ ] 1.6 Remove `useUploadBroadcastThumbnail`'s on-select mutation wiring from
      `app/(app)/live/broadcast.hooks.tsx`, since selection no longer mutates.

## 2. Listing previous broadcasts

- [ ] 2.1 Add `listReusableBroadcastsAction` to `app/(app)/live/broadcast.actions.ts`, returning
      ended broadcasts for the owner's channel with id, title, thumbnail path and start time,
      newest first, with a bounded limit.
- [ ] 2.2 Add a matching query hook in `app/(app)/live/broadcast.hooks.tsx`, enabled only while
      the dialog is open so the list is not fetched on every page load.
- [ ] 2.3 Add `getBroadcastSettingsAction(streamId)` returning the full settings shape for one
      ended broadcast, reusing the existing settings selection so the reuse path and the load
      path cannot diverge.

## 3. The dialog

- [ ] 3.1 Add a "Reuse stream settings" button at the top of the Settings tab, disabled while
      the active broadcast is live.
- [ ] 3.2 Build the dialog listing each broadcast as a row with its thumbnail, its title and its
      date, with a placeholder image where there is no thumbnail.
- [ ] 3.3 State in the dialog that the YouTube video URL and the scheduled start time are not
      copied.
- [ ] 3.4 On selection, fill the form through the existing `setForm`, carrying the thumbnail
      across as the existing stored key rather than as a new upload, then close the dialog.

## 4. Prove it

- [ ] 4.1 Add `tests/unit/settings-reuse.test.ts` asserting that filling from a previous
      broadcast copies every field except the YouTube URL and the scheduled start, driven from
      the field list rather than a hand-written subset so a new setting cannot be forgotten.
- [ ] 4.2 Add `tests/unit/thumbnail-staging.test.ts` asserting that selection stages without
      writing, that an oversized or wrong-typed file is rejected at selection, and that saving
      uploads exactly once.
- [ ] 4.3 Add to `tests/e2e/` a spec asserting that choosing a thumbnail with no encoder
      connected leaves an edited title intact, that reloading without saving leaves the
      broadcast unchanged, and that saving applies both.
- [ ] 4.4 In that spec, assert the reuse button is disabled while live, that the dialog lists
      only ended broadcasts, and that selecting one fills the form without writing.

## 5. Land it

- [ ] 5.1 Run `openspec validate --strict` and archive.

## 1. The column and the policy

- [x] 1.1 Add migration `add_video_visibility`: `videos.visibility text not null default 'public' check (visibility in ('public','unlisted','private'))`.
- [x] 1.2 In the same migration, backfill every existing row to `public`, so nothing currently visible disappears.
- [x] 1.3 In the same migration, set the 8-Aug-2026 recording to `private` and correct its `status` from `failed` back to `ready`, since it is marked failed only in order to hide it. Match it by `source_stream_id` rather than by video id, so the migration reads as what it does.
- [x] 1.4 In the same migration, replace the public read policy so a row is readable when `status = 'ready'` and either `visibility in ('public','unlisted')` or the reader owns the channel. Keep the existing owner-reads-processing policy intact.
- [x] 1.5 Deviation: no database guard was added, and the reason is recorded in the migration. The table has no UPDATE policy at all, so no client can write any column of it; the only writer is a server action holding the service key. An owner-only trigger would fire for that writer too, whose `auth.uid()` is null, and would block the legitimate path while guarding one that does not exist. Ownership is enforced in the action instead.
- [x] 1.6 Run `npx supabase db push`, then regenerate types with `npm run db:types`.

## 2. Reading

- [x] 2.1 Exclude `unlisted` and `private` recordings from the channel listing query, leaving them readable by address.
- [x] 2.2 Include the owner's own withheld recordings in the studio listing, carrying their visibility so the studio can label them.
- [x] 2.3 Return not-found rather than forbidden when a private recording is requested by anyone but the owner, so its existence is not disclosed.
- [x] 2.4 Checked every reader. One real fault found and fixed: the overlay backdrop pulled the owner's recordings with the service key, so a recording withheld for what is visible in it would have had its preview stills drawn on a live broadcast. It is now public-only. The studio and timeline readers are owner-gated and correctly still see withheld recordings; the finalize and ingest paths are writers and are unaffected.

## 3. Writing

- [x] 3.1 Add a visibility control to the studio, on the recording itself, offering public, unlisted and private with one line each saying who can reach it.
- [x] 3.2 Add the action and hook that write it, following the expected-versus-unexpected error split.
- [x] 3.3 Show the current visibility on the recording wherever the owner sees it listed, so a withheld recording is never mistaken for a missing one.

## 4. Proving it

- [x] 4.1 Add a database check, in the style of `supabase/rls-check.ts`, asserting from an anonymous reader that a public recording is returned, an unlisted one is returned by direct request, a private one is not returned at all, and the owner receives all three.
- [x] 4.2 Assert the private case returns nothing rather than an error, so the failure mode is not-found rather than forbidden.
- [x] 4.3 Added `tests/e2e/vod-visibility.spec.ts`: the channel lists the public recording only, an unlisted one still plays from its own address, and a private one is not found. Written but not executed here, since running it starts a local dev server. Runs in the normal end-to-end pass.
- [x] 4.4 Confirm after migration that exactly one recording is private and that its status reads ready.

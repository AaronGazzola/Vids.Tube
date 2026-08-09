## 1. The column and the policy

- [ ] 1.1 Add migration `add_video_visibility`: `videos.visibility text not null default 'public' check (visibility in ('public','unlisted','private'))`.
- [ ] 1.2 In the same migration, backfill every existing row to `public`, so nothing currently visible disappears.
- [ ] 1.3 In the same migration, set the 8-Aug-2026 recording to `private` and correct its `status` from `failed` back to `ready`, since it is marked failed only in order to hide it. Match it by `source_stream_id` rather than by video id, so the migration reads as what it does.
- [ ] 1.4 In the same migration, replace the public read policy so a row is readable when `status = 'ready'` and either `visibility in ('public','unlisted')` or the reader owns the channel. Keep the existing owner-reads-processing policy intact.
- [ ] 1.5 In the same migration, add a column-level guard so only the channel owner can write `visibility`.
- [ ] 1.6 Run `npx supabase db push`, then regenerate types with `npm run db:types`.

## 2. Reading

- [ ] 2.1 Exclude `unlisted` and `private` recordings from the channel listing query, leaving them readable by address.
- [ ] 2.2 Include the owner's own withheld recordings in the studio listing, carrying their visibility so the studio can label them.
- [ ] 2.3 Return not-found rather than forbidden when a private recording is requested by anyone but the owner, so its existence is not disclosed.
- [ ] 2.4 Check every other reader of recordings against the new policy: chat replay, the timeline pages and the hover preview. Fix any that assumed every ready recording is readable.

## 3. Writing

- [ ] 3.1 Add a visibility control to the studio, on the recording itself, offering public, unlisted and private with one line each saying who can reach it.
- [ ] 3.2 Add the action and hook that write it, following the expected-versus-unexpected error split.
- [ ] 3.3 Show the current visibility on the recording wherever the owner sees it listed, so a withheld recording is never mistaken for a missing one.

## 4. Proving it

- [ ] 4.1 Add a database check, in the style of `supabase/rls-check.ts`, asserting from an anonymous reader that a public recording is returned, an unlisted one is returned by direct request, a private one is not returned at all, and the owner receives all three.
- [ ] 4.2 Assert the private case returns nothing rather than an error, so the failure mode is not-found rather than forbidden.
- [ ] 4.3 Add a browser test that a channel page lists the public recording and does not list the unlisted one.
- [ ] 4.4 Confirm after migration that exactly one recording is private and that its status reads ready.

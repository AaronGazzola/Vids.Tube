## 1. Data and storage

- [ ] 1.1 Create a migration with `npx supabase migration new add_chatter_sounds` adding `public.chatter_sounds`: `channel_id uuid not null references channels(id) on delete cascade`, `community_channel_id uuid not null references channels(id) on delete cascade`, `member_path text`, `member_status text check (member_status in ('pending','approved','rejected'))`, `member_uploaded_at timestamptz`, `owner_path text`, `owner_uploaded_at timestamptz`, `muted boolean not null default false`, `reviewed_at timestamptz`, `unique (channel_id, community_channel_id)`, `check (channel_id <> community_channel_id)`, plus an index on `community_channel_id`.
- [ ] 1.2 In the same migration insert the `chatter-sounds` storage bucket public with `file_size_limit` 262144 and `allowed_mime_types` `array['audio/mpeg','audio/ogg','audio/wav','audio/webm']`, following the shape of the `channel-assets` bucket insert.
- [ ] 1.3 In the same migration add RLS policies on `chatter_sounds`: a member reads and writes the row whose `channel_id` is a channel they own (`channels.owner_user_id = auth.uid()`) but may set only `member_path`, `member_status = 'pending'` and `member_uploaded_at`; the owner of `community_channel_id` reads and writes every column of every row in their community; anonymous readers select rows whose `community_channel_id` has a stream with `ended_at is null`, mirroring the live-scoped `stream_greetings` read policy, so the overlay reads without the service role.
- [ ] 1.4 In the same migration add storage policies on `storage.objects` for the `chatter-sounds` bucket: a signed-in user inserts and updates only under a path prefixed with their own channel id, the community owner inserts and updates under any path prefixed with a member channel id of their community, and select is public because the overlay fetches by URL.
- [ ] 1.5 Push with `npx supabase db push` and regenerate `supabase/types.ts` with `npx supabase gen types typescript --project-id cqblezzhywdjerslhgho`.

## 2. Shared resolution, actions and hooks

- [ ] 2.1 Add `lib/chatter-sound.ts` exporting `CHATTER_SOUND_MAX_SECONDS = 3`, a `ChatterSoundRecord` type mirroring the table, and a pure `resolveChatterSound(record): { kind: 'member' | 'owner' | 'default'; path: string | null }` returning `member` only when `member_status === 'approved'` and `muted` is false, `owner` when `owner_path` is set and `muted` is false, and `default` otherwise, so a muted record never resolves to the owner's upload.
- [ ] 2.2 Add `measureAudioDuration(file): Promise<number>` to `lib/chatter-sound.ts`, decoding the file with `AudioContext.decodeAudioData` and returning its duration in seconds, throwing on a file that cannot be decoded.
- [ ] 2.3 Add to `app/layout.actions.ts`, using the RLS-bound server client and never `supabaseAdmin`: `getChatterSoundAction(memberChannelId, communityChannelId)` returning the record or null; `uploadMemberSoundAction` writing `member_path`, `member_status = 'pending'` and `member_uploaded_at`; `uploadOwnerSoundAction` writing `owner_path` and `owner_uploaded_at`; `reviewMemberSoundAction(status)` writing `member_status` and `reviewed_at`; `setSoundMutedAction(muted)`. Each returns `ActionResult<T>` and returns rather than throws on an unauthorised or over-length input.
- [ ] 2.4 Add to `app/layout.hooks.tsx` a `useChatterSound(memberChannelId, communityChannelId)` query hook and one mutation hook per action in 2.3, each unwrapping `ActionResult` in `mutationFn` so `onError` toasts carry the returned message, and invalidating the `["chatter-sound", memberChannelId, communityChannelId]` key on success.

## 3. Owner surface

- [ ] 3.1 Add `components/chatter-sound-dialog.tsx` taking `memberChannelId`, `communityChannelId` and the member's display name, rendering: the currently resolved sound with a play button, an upload field that rejects a file over `CHATTER_SOUND_MAX_SECONDS` using `measureAudioDuration` before uploading and names the measured length in the rejection, a mute switch, and a line stating which sound resolves and that a member's approved sound outranks the owner's upload.
- [ ] 3.2 In `components/chatter-sound-dialog.tsx` render an approval block only when `member_status === 'pending'`: play the pending sound, approve, reject.
- [ ] 3.3 Add `components/chatter-sound-button.tsx`, an icon button that opens the dialog and takes a distinct style when `member_status === 'pending'`, rendering nothing when the viewer is not the community owner.
- [ ] 3.4 Render the button on each member row in `components/community-section.tsx`, passing the owner flag down from `components/channel-view.tsx`, which already receives `isOwner`.
- [ ] 3.5 Add the member's identity channel id and their sound status to `CommunityMember` in `app/[channelSlug]/page.types.ts` and select them in the community and leaderboard queries in `app/[channelSlug]/page.actions.ts`, so a row can render its button state without a per-row fetch.
- [ ] 3.6 Render the same button on each competition leaderboard entry in `app/(app)/live/panels.tsx`, resolving the entry's participant key to its identity channel in the leaderboard query in `app/(app)/live/page.actions.ts`.

## 4. Member surface

- [ ] 4.1 Add a sound section to `app/(app)/account/page.tsx` listing the signed-in user's memberships, each with the current state of their sound (none, awaiting approval, approved, rejected, muted), a play button for their own uploaded sound whatever its state, and an upload field applying the same duration guard as the dialog.
- [ ] 4.2 Add `getMyMembershipSoundsAction` to `app/(app)/account/page.actions.ts` returning one entry per membership with its community name and sound record, and a `useMyMembershipSounds` query hook in `app/(app)/account/page.hooks.tsx`.
- [ ] 4.3 Render the section empty-state when the signed-in user holds no membership, stating that a sound is set per community.

## 5. Overlay playback

- [ ] 5.1 In `lib/overlay-chime.ts` add `playChatterSound(url: string | null): Promise<void>` playing the URL through an `Audio` element, resolving on `ended`, on `error`, and on a `CHATTER_SOUND_MAX_SECONDS` timeout that pauses playback, and falling back to `playOverlayChime()` when the URL is null. Keep `playOverlayChime` unchanged.
- [ ] 5.2 In `app/(overlay)/overlay/[channelSlug]/page.actions.ts` resolve each promoted highlight, spoken message and ask exchange to its member's sound URL alongside the identity each already resolves, applying `resolveChatterSound`, and return it on the item.
- [ ] 5.3 Change `useOverlayChime` in `app/(overlay)/overlay/[channelSlug]/page.hooks.tsx` to take the slot key and the resolved sound URL and call `playChatterSound`, keeping the existing behaviour of firing once per new slot key.
- [ ] 5.4 Pass the resolved URL from `LiveFeedSlot` in `app/(overlay)/overlay/[channelSlug]/page.tsx`, keeping the existing `soundOn` switch as the outermost gate so a switched-off overlay plays nothing.
- [ ] 5.5 Add a `leadingSoundSrc` prop to `components/overlay/tts-card.tsx` that awaits `playChatterSound` before starting the spoken audio, and starts the spoken audio regardless of how that promise settled.
- [ ] 5.6 Leave the demo feed in `DemoOverlayFeed` on the default bell, since demo items carry no member identity, and pass null so the demo path is explicit rather than incidental.

## 6. Identity merge

- [ ] 6.1 Create a migration with `npx supabase migration new add_sound_merge_collision` extending the claim/merge function from `20260726143518_channel_membership_model.sql` to resolve `chatter_sounds` collisions: where source and survivor both hold a row for one community, keep the row with an approved `member_status` over one without, then the later `member_uploaded_at`, keep the survivor's `muted` value, delete the other row, and re-point any surviving source row to the survivor's channel id.
- [ ] 6.2 Add `scripts/verify-sound-merge.ts` following `scripts/verify-credit-merge.ts`: seed two identities each holding a sound in one community, run the merge, and assert the surviving row matches the rule for each of the approved-versus-unapproved, both-approved, muted and single-sided cases.

## 7. Tests

- [ ] 7.1 Add `tests/unit/chatter-sound-resolve.test.ts` covering `resolveChatterSound`: member approved wins over owner upload, owner upload wins when the member sound is pending or rejected, muted falls to default even when both are present, and no record falls to default.
- [ ] 7.2 Add `tests/unit/chatter-sound-player.test.ts` covering `playChatterSound`: resolves on `ended`, resolves on `error`, resolves at the 3 second bound and pauses playback, and falls back to the bell on a null URL.
- [ ] 7.3 Add a case to `tests/unit/chatter-sound-player.test.ts` asserting the spoken-message card starts its audio after the leading sound settles and also when the leading sound errors.
- [ ] 7.4 Run the suite with `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run` and fix what fails.

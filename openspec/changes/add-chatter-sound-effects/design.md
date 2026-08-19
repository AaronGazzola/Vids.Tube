## Context

The overlay announces every chatter moment with one hardcoded two-note bell,
synthesized in the browser by `playOverlayChime` and fired from `useOverlayChime`
whenever a new item takes the shared overlay slot. There is one slot: a
highlighted message, a spoken message and an ask exchange never render together.

Identity in this codebase is a channel row. Every chatter, claimed or not, has
one. A membership pairs a chatter's identity channel with a community channel.
Chat rows carry a `participant_key` instead, which is per-platform, and the
identity merge rewrites that key across `command_events`, `tts_requests`,
`ask_requests`, `clip_markers` and `banned_participants` when a YouTube identity
is linked to an account. Anything keyed on `participant_key` that the merge has
not been taught about is orphaned by a link. That is the open badge-destroying
bug, and this change must not repeat it.

The `tts` bucket is the closest precedent for storing audio, and `channel-assets`
is the precedent for a bucket that declares its own size cap and content-type
allowlist.

## Goals / Non-Goals

**Goals:**

- A member's overlay moments are announced by a sound that member chose.
- The community owner can furnish a sound for a member who has not chosen one,
  and can silence one, but can never substitute a different sound for a member's
  own approved choice.
- Nothing a member uploads reaches a live broadcast without the owner hearing it
  first.
- A sound cannot exceed 3 seconds in storage or in playback.
- Linking a YouTube identity to a site account does not lose a sound.

**Non-Goals:**

- No chat command. Nothing is added to the command registry, and discovery is
  the account page plus the owner telling chat.
- No catalogue of built-in sounds to pick from. The one built-in is the existing
  bell, kept as the default.
- No trimming, normalising, transcoding or loudness control of an uploaded file.
- No per-moment sounds. One sound per member per community covers every moment.
- No credit cost or economy tie-in.

## Decisions

### Key the record on the identity channel, not the participant key

One record per member per community: `(channel_id, community_channel_id)`,
matching how a membership is keyed.

Alternative considered and rejected: keying on `participant_key`, which is what
`tts_requests` and `ask_requests` do. Rejected because the merge rewrites that
key and would silently orphan a sound, exactly as it orphans badges today.
Keying on the identity channel means the merge needs to handle only the
collision case, where both identities happen to hold a sound in the same
community, and never the ordinary case.

The overlay reads by participant key, so a resolution step is still needed. The
overlay fetches for highlights, spoken messages and ask exchanges already resolve
a participant key to an identity in order to render the author, so the sound is
read alongside that existing resolution rather than through a new lookup.

### One row with two sound columns, not two rows

`chatter_sounds(channel_id, community_channel_id, member_path, member_status,
member_uploaded_at, owner_path, owner_uploaded_at, muted, reviewed_at)`.

Resolution is `member_path` where `member_status` is approved and not muted, then
`owner_path` where not muted, then the default bell. A muted record resolves to
the bell directly.

Alternative considered and rejected: a `source` enum with one row per uploader.
Rejected because it turns every read into a precedence query and every write into
an upsert against a compound key, for no gain: there are exactly two uploaders
and never more.

### Muting falls back to the bell, never to the owner's upload

If a muted member sound fell back to the owner's upload, an owner could mute and
upload and have replaced the member's sound in two steps. Falling back to the
bell is what makes "the owner can never replace a member's sound" true rather
than merely stated.

### Length is bounded three times, and only one of the three is authoritative

- The browser decodes the picked file with `decodeAudioData` and refuses over 3
  seconds before any bytes are sent. This is what a member experiences as the
  limit.
- The bucket declares a size cap and an audio content-type allowlist, enforced by
  Supabase Storage and unbypassable.
- Playback stops at 3 seconds whatever was stored.

Honest limit: the duration check is browser-side, because measuring duration
server-side means shipping an audio decoder into the web app or deferring to the
worker, and neither is worth it here. A crafted request can therefore store a
long file at a low bitrate within the size cap. What holds in that case is the
owner's approval, which no member upload skips, and the playback bound. The
owner's own upload skips approval, but the owner is not the threat.

### One dialog is the whole owner surface

The sound button on a member row opens a dialog that uploads, plays, approves,
rejects and mutes. An earlier draft put approval in the live feed as a card
beside the spoken-message cards. Rejected because it split one decision across
two surfaces and put a queue in front of the owner mid-broadcast when the
decision is not urgent.

The same button and dialog render on both member surfaces: the community section
on a channel page, and the competition leaderboard in the control room. The
community list keys on membership and the leaderboard keys on participant key, so
the shared dialog takes the identity channel and each surface resolves to it.

### The shared player settles once, whatever happens

`playChatterSound(url)` returns a promise settling when the audio ends, when the
3 second bound fires, or when loading fails. The spoken-message card awaits it
before starting its own audio. Nothing downstream branches on why it settled, so
a missing file, a slow fetch and a long file all behave the same and no moment
can hang.

The existing bell stays as it is and becomes what the resolver returns when no
sound is set, so the default path is unchanged code.

### The welcome card hook is provided but not wired here

The overlay welcome card is being built as `add-overlay-welcome-card` in another
session. This change provides the player and the resolver and wires the two
moments that exist today. The welcome card calls the same player when it lands.

## Risks / Trade-offs

- **A member uploads something offensive and it plays on a live broadcast** →
  no member upload plays before the owner approves it, and the owner hears it in
  the dialog before deciding. Muting silences an approved sound without deleting
  it, so a sound that turns out to be a problem is one switch away from gone.
- **A long file slips past the browser check and holds the broadcast** → the
  playback bound cuts at 3 seconds regardless, and the bucket size cap keeps the
  file small enough that fetching it is not itself a stall.
- **The overlay stalls waiting on a sound that will not load** → the player
  settles on failure and on timeout, and the spoken audio starts either way.
- **A merge loses a sound** → sounds are keyed on the identity channel, which the
  merge repoints rather than rewrites, so only the collision case needs handling
  and it is specified.
- **Storage grows without bound as members re-upload** → a member has one row and
  one file; re-uploading replaces both, so the ceiling is one file per member per
  community.
- **Two surfaces drift apart** → the button and dialog are one component used by
  both member lists, so a change to approval or muting lands in both.

## Migration Plan

- The new table and bucket are additive. No existing row or file changes.
- Until a member or owner uploads anything, every resolution returns the bell,
  which is what plays today, so the overlay is unchanged for a channel that never
  uses the feature.
- Rollback is switching the overlay resolver back to the bell; the table and
  bucket can be left in place.

## Open Questions

None. The precedence rule, the mute fallback, the merge collision rule and the
three length bounds were settled before this document was written.

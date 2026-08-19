## Why

A small streamer's advantage is remembering people. Today nothing helps: when a regular's first
message of the broadcast lands, everything the channel knows about them is spread across a year of
chat and no surface holds it.

The public half of that knowledge is already stored and already rendered — level, XP, rank, credits,
messages, broadcasts attended, streaks, badges. The half that actually helps a conversation is not
stored anywhere: what someone is studying, what they do, the project they mentioned, and above all
the things with a shelf life. Somebody was sick last broadcast. Somebody has an exam this week. "How
did the exam go?" is the sentence this change exists to make possible, and today it is only possible
by luck.

This change writes that knowledge down. The surfaces that read it are `add-chatters-panel`.

## What Changes

- Every chatter who spoke in a broadcast gets a short private list of remembering points, written
  after the broadcast ends rather than while they are speaking.
- Writing joins the post-broadcast pass as its last step, so the always-on maintenance machine
  already runs it and nothing new has to be scheduled or installed.
- Notes are written the same evening a broadcast ends, and rewritten about a day later once the
  YouTube chat replay has been merged, so they reflect both halves of the conversation.
- By the time the next broadcast starts the notes are already stored. Nothing is generated at chat
  time, so no panel ever waits on a model and no chatter's arrival costs a Claude call.
- A chatter who has said nothing new since their notes were written is skipped without a call. The
  regeneration test is the one `me_profiles` already uses, reused rather than rewritten.
- Notes are private to the channel owner and enforced as private by a policy, not by a check inside
  one function. They are a synthesis of things people said in public, which is exactly why they must
  never be shown back to the person described.
- Check-in items carry the date they were raised, so a stale one can be dropped rather than asked
  about six months late.

## Capabilities

### New Capabilities

- `chatter-recall-notes`: a private, per-membership list of remembering points written by the
  post-broadcast pass and readable only by the channel owner.

### Modified Capabilities

- `post-broadcast-pass`: writing notes becomes the pass's last step, in both phases, and is skipped
  rather than run stale when the membership rebuild fails.

## Impact

- A migration adding one table keyed by membership, readable only by the owner of the community, with
  no write policy at all so writes stay with the worker.
- A script that writes notes for one broadcast, runnable by hand like every other step of the pass.
- The pass's step list, its dependency rules and its per-step judgement gain a sixth entry.
- **Not in this change:** any UI. Nothing reads the notes until `add-chatters-panel` lands, and the
  two are separable on purpose — the notes are worth having even if the panel changes shape.
- **Not in this change:** the public AI mini-bio behind `!me`. That is a different artefact with a
  different audience and it is left alone.
- **Not in this change:** playback of a chatter's name. Word-level timing is not recorded by the
  transcription step and there is no audio-trimming path, so locating the moment a name was said is
  not possible yet. Held in AZ-275.

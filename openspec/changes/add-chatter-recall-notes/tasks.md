# Tasks

## 1. Where the notes live

- [x] 1.1 Migration creating `chatter_notes`: `membership_id uuid primary key references memberships(id) on delete cascade`,
      `notes jsonb not null default '[]'`, `snapshot jsonb not null`, `source_stream_id uuid references streams(id) on delete set null`,
      `generated_at timestamptz not null default now()`. One row per membership, so a chatter's notes
      are scoped to the community exactly as every other membership value is.
- [x] 1.2 Same migration: enable row-level security and add exactly one policy, a `select` granted when
      the requester owns the `community_channel_id` of the row's membership. No insert, update or
      delete policy at all — writes stay with the service role, as every other post-broadcast write
      does.
- [x] 1.3 Note shape, documented in the migration comment and mirrored in the type: an array of
      `{ text, kind, raised_at }` where `kind` is `standing` or `checkin` and `raised_at` is a date.
      Snapshot shape: `{ message_count, streams_attended }`, matching what the regeneration test reads.
- [x] 1.4 Regenerate `supabase/types.ts` after the push.
- [x] 1.5 `scripts/verify-chatter-notes-rls.ts`: prove with the anon client that a member cannot read
      their own row, that another community's owner cannot read it, and that the owning channel's owner
      can. Follow the shape of the existing RLS verification scripts.

## 2. Writing the notes

- [x] 2.1 `worker/lib/chatter-notes.ts`: `gatherNoteInputs(membershipId, streamId)` reading the
      chatter's messages in that broadcast from `chat_messages` across both origins, bounded to the 20
      most recent, and for each one the `transcript_segments` rows within 30 seconds either side of it.
      Anchor message times to the broadcast the same way chat replay does, using `streams.live_at` and
      falling back to `started_at`.
- [x] 2.2 Same file: `buildNotesPrompt(inputs, existingNotes)` asking for standing points and check-in
      points separately, each with the date it was raised, and stating that a point not supported by
      the supplied messages or transcript must not be written. Supply the existing notes so a known
      point is updated rather than repeated.
- [x] 2.3 Same file: `parseNotes(response)` returning the typed array, dropping anything malformed
      rather than throwing, and `pruneNotes(notes, now)` applying the three stored limits — check-ins
      older than 60 days dropped, at most 3 check-ins, at most 8 points, most recently raised kept.
- [x] 2.4 Same file: `needsNotes(membership, stored)` returning false when the stored snapshot's
      message count and attendance both match the membership. Reuse the comparison
      `needsRegeneration` already makes in `worker/lib/me-command.ts` rather than writing a second
      rule; extract it if that is the shorter diff.
- [x] 2.5 Call Claude through `runClaude` in `worker/lib/claude.ts`. No second invocation path.
- [x] 2.6 `tests/unit/chatter-notes.test.ts`: a well-formed response parses; a malformed one yields no
      notes rather than throwing; a check-in dated 61 days ago is pruned and one dated 59 days ago is
      kept; four check-ins prune to the three most recent; nine points prune to eight; an unchanged
      snapshot is skipped and a changed one is not.

## 3. The step script

- [x] 3.1 `scripts/write-chatter-notes.ts --stream <id> --apply`, listing the memberships whose chatter
      authored at least one `chat_messages` row in that broadcast, excluding the host and excluding
      channels marked `is_software`.
- [x] 3.2 Order the list by that chatter's message count in the broadcast, descending, and stop after
      40 model calls. Everything past the cap is counted, not silently dropped.
- [x] 3.3 Print progress per chatter and finish with `printStepResult({ written, skipped, capped, failed })`.
      `skipped` counts unchanged snapshots; `capped` counts memberships past the limit; `failed` counts
      model or write errors.
- [x] 3.4 Without `--apply`, write nothing and report what would have been written, matching the dry-run
      behaviour of the other step scripts.

## 4. Into the pass

- [x] 4.1 `lib/post-broadcast-plan.ts`: add `writeNotes` to `StepName` and to the end of `STEP_ORDER`,
      and add `writeNotes: "rebuildMemberships"` to `REQUIRES`. Both phases pick it up from `STEP_ORDER`
      without further change, which is the point of it going there.
- [x] 4.2 Same file: a `judgeStep` case for `writeNotes` — `failed > 0` is a failure, an absent `failed`
      or `written` count is unknown, and zero written with zero failed is fine, because a broadcast where
      every chatter was unchanged legitimately writes nothing.
- [x] 4.3 `worker/lib/post-broadcast.ts`: add the `writeNotes` entry to `STEP_COMMANDS`, invoking the
      script for the one broadcast being settled.
- [x] 4.4 `tests/unit/post-broadcast-plan.test.ts`: extend the existing cases so the new step is ordered
      last in both phases, is skipped when the rebuild failed, fails the phase when it reports failures,
      is clean when it reports zero written and zero failed, and is unknown when it reports nothing.
- [x] 4.5 Confirm a broadcast already recorded as settled is not picked up again by the added step:
      `phaseOwed` returns null on a settled record regardless of the step list, and `isClean` compares
      against the current phase's steps rather than against a stored count.

## 5. Land it

- [x] 5.1 Run the notes step by hand against the most recent settled broadcast and read the output:
      `doppler run -- npx tsx scripts/write-chatter-notes.ts --stream <id> --apply`. Run against the
      17-Aug-2026 broadcast: 3 chatters, 3 written, 0 failed, 1 to 5 points each, both kinds present,
      caps respected.
- [x] 5.2 **Found and fixed by this run.** Every point came back dated the day the script ran rather
      than the day the thing was said, because the messages were supplied without their dates and the
      model filled the gap with today. Check-in staleness is measured from that date, so a catch-up
      over old broadcasts would have stamped year-old check-ins as current and never expired them.
      The message date is now supplied per message and the prompt is told to copy it. Re-run against
      the same broadcast: every point dated 17-Aug-2026.
- [x] 5.3 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`. Typecheck clean,
      lint clean on the new files, 887 tests with one pre-existing unrelated failure in the tool-path
      resolver, which asserts a path is rewritten out of another user's home and cannot pass on a
      machine whose user is the one named in the fixture.
- [x] 5.4 `openspec validate --strict`.

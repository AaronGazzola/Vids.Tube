## 1. Abandonment sweep

- [x] 1.1 `supabase/migrations/20260731144656_end_abandoned_live_streams.sql`:
  `public.end_abandoned_live_streams()` — `language plpgsql`, `security definer`,
  `set search_path = public`, execute revoked from public/anon/authenticated
  (verified acl: `postgres`, `service_role` only).
  For each `streams` row with `status='live'` and
  `coalesce(last_seen_at, started_at) < now() - interval '2 hours'` and
  (`break_ends_at is null` or `break_ends_at < now() - interval '2 hours'`):
  closes the open `stream_gaps` row at the resolved end time, updates the stream
  to `status='ended'` with `ended_at = coalesce(last_seen_at, started_at, now())`
  guarded by `where status='live'`, then flips its `videos` row to `status='ready'`
  with `published_at` where `source_stream_id` matches, `status='processing'`, and
  `mp4_path is not null`. Returns the count and raises a notice per stream.
- [x] 1.2 Same migration: `create extension if not exists pg_cron`, unschedule any
  prior `end-abandoned-live-streams` job, `cron.schedule` at `*/15 * * * *`.
- [x] 1.3 `doppler run -- npx supabase db push` applied; `npm run db:types`
  regenerated (`end_abandoned_live_streams: { Args: never; Returns: number }`).

## 2. Resolve the stranded 2026-07-28 broadcast

- [x] 2.1 Invoked against prod: stream `fa1437e7-23b2-434e-b382-540decebbc8a` is
  `ended` with `ended_at = 2026-07-28T15:15:09.005Z`, its gap
  (`gap_start_at = 15:15:34.534`) is closed at `15:15:34.534`, and VOD
  `0a14c71a-54c1-43f6-8d97-324318ae97d2` is `ready` with
  `published_at = 2026-07-31T14:48:58.444Z`.
- [x] 2.2 Confirmed post-run: zero `processing` `videos` rows and zero `live`
  `streams` rows remain.

## 3. Verify

- [x] 3.1 `scripts/verify-abandoned-sweep.ts` (`npm run verify:abandoned-sweep`):
  six guard cases seeded against prod inside rolled-back transactions — fresh
  feed, 90-minute disconnect, and a running break are left `live`; 4-hour
  silence, a long-past break, and a never-seen row are ended with the gap closed
  and the VOD published. All pass, zero probe rows leak.
- [x] 3.2 `cron.job` contains `end-abandoned-live-streams`, `*/15 * * * *`,
  `active = true`.
- [x] 3.3 `npx tsc --noEmit` clean; `npm run lint` 0 errors (9 pre-existing
  `<img>` warnings).

## 1. Data model

- [x] 1.1 Migration `add_info_commands`: `alter table streams add column
  disabled_commands text[] not null default '{}'`; seed builtins
  rank/top/goal/uptime for every channel (cooldown_s 60, sort_order 20-23,
  descriptions) on conflict do nothing
- [x] 1.2 Push migration + regen types

## 2. Worker

- [x] 2.1 `worker/lib/info-commands.ts`: `rankHandler`, `topHandler`,
  `goalHandler`, `uptimeHandler` per design.md (viewer_scores ranking with name
  resolution; stream_goals + fetchSubs/fetchVideoData + computeGoalProgress;
  live_at uptime) — every handler replies through ctx.reply and degrades to a
  friendly line when data is missing
- [x] 2.2 `worker/lib/commands.ts`: register the four builtins; execute custom
  rows (non-empty response -> reply); accept `disabledCommands: string[]` in
  `CommandStreamInfo` and log `disabled` for excluded keywords before other
  checks
- [x] 2.3 `worker/jobs/score.ts`: fetch `streams.disabled_commands` each pass
  and pass it through

## 3. Settings manager

- [x] 3.1 `app/(app)/live/commands.actions.ts`:
  `getChannelCommandsAdminAction()` (owner, all rows ordered),
  `createCustomCommandAction({keyword, description, response, cooldownS})`
  (validated lowercase keyword, expected-error on duplicates),
  `updateCustomCommandAction`, `deleteCustomCommandAction` (custom rows only)
- [x] 3.2 `app/(app)/live/commands.hooks.tsx`: query + mutation hooks
  invalidating the admin list and the public guide query
- [x] 3.3 `app/(app)/live/settings-tab.tsx`: "Chat commands" section — worker
  status note (existing heartbeat data), unified list (checkbox bound to
  `form.disabledCommands`, `!keyword`, description; Edit/Delete buttons on
  custom rows; Add command dialog with keyword/description/response/cooldown)
- [x] 3.4 Form plumbing: `SettingsForm.disabledCommands: string[]` in
  `page.tsx` buildForm/buildPayload + `broadcast.actions.ts` settings
  read/write of `streams.disabled_commands`

## 4. Verify

- [x] 4.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run`,
  `doppler run -- npm run build` clean
- [x] 4.2 `scripts/verify-info-commands.ts` (guarded, remote db): seed scheduled
  stream + scoring + viewer_scores rows + a custom `!pc` row; run the worker;
  post `!pc`, `!rank`, `!top`, `!uptime`, and `!goal`; assert executed events
  with expected reply shapes (custom response text; rank/points; top-3 names;
  uptime line; goal not-configured line); set `disabled_commands=['pc']`, post
  `!pc` again next pass -> `disabled` event, no reply; cleanup
- [x] 4.3 e2e (`tests/e2e/info-commands.spec.ts`): owner opens /live Settings ->
  Chat commands section lists builtins with checkboxes and no Edit control;
  adds a custom command via the dialog -> appears in the list and on
  `/{slug}/commands`; deletes it; per-stream checkbox round-trips through Save
  changes (assert `streams.disabled_commands` via admin)
- [x] 4.4 `npx openspec validate add-info-commands --strict`

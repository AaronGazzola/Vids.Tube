# Vids.Tube Roadmap

Two-track build plan for Vids.Tube (this repo) and eco3d.shop (`../eco3d.shop`,
see its `docs/roadmap.md` for the E-track detail). Written 2026-07-26 after the
strategy sessions that settled the platform direction. Future agents: read this
document, then pick work from the Linear backlog (Az team, Vids.Tube project)
filtered to the current phase — ticket titles carry phase labels like `[V1]`.
Per CLAUDE.md governance, promote a ticket into a new OpenSpec change before
writing any code.

## Platform thesis

Vids.Tube is a community-focused live streaming platform for small streamers,
built and used by the owner first, opened to other streamers later. YouTube is
distribution; Vids.Tube is home. Every chatter is a future streamer. Features
that create real agency for chatters (identity, economy, games, physical
rewards) are the product.

Content policy: live-only. VODs, clips, and shorts all derive from live
streams; there is no standalone upload path.

Adjacent products: eco3d.shop (breed-and-sell creature tycoon game +
compostable 3D-print fulfillment; integrates as overlay games and merch),
AzAnything.dev (vibe-code coaching; deliberately parallel, NOT integrated —
only generic touchpoints like `channel_projects` grounding for `!ask`).

## Settled decisions (do not re-litigate)

- **Identity model**: one `channel` per identity (banner, avatar, handle, bio).
  A channel with no streams renders as a profile; with streams it renders like
  a normal channel. Per-streamer relationship is a `membership`
  (channel x community) holding XP, Level, Credits, streak, per-stream history,
  rewards. No DMs, no social feed, no follows between chatters.
- **Unclaimed channels**: auto-created for every archived YouTube chatter
  (keyed by `youtube_channel_id`), showing chat stats only. Claiming (verify
  code posted in YouTube chat) merges the YouTube identity into the user's
  channel: raw events re-keyed, all aggregates recomputed from the pooled
  history. Never merge aggregates — merge raw events and recompute.
- **Economy**: XP (per-stream, monotonic, individual engagement only; tonight's
  overlay rank derives from it) · Level (career, from lifetime XP, shown as a
  badge, gates unlocks) · Credits (accumulate across streams, spendable,
  per-membership, never transferable between communities). Streak = flat XP +
  Credits bonus per consecutive stream (no multipliers). Collective windfalls
  (bingo, game events) pay Credits only, never XP. `credit_cost` column on the
  `chat_commands` registry prices any command including custom ones.
- **eco3d currency valve**: the tycoon game runs on its own in-game currency.
  Credits convert INTO the game (eggs, gifts) and never convert back out.
- **Overlay architecture**: one full-frame browser source per channel
  (1080x1920; landscape later via a `canvas` config field), all elements
  absolutely positioned from per-channel config (`overlay_layouts`, renamed
  from `demo_layouts`), optional `?token=` auth, realtime layout push. Layout
  editing happens live on the /live Preview tab (element toggles,
  position/scale, notification sounds/mute) — demo mode is only for simulated
  activity. Old per-element overlay URLs are removed, no transition period.
- **Activity tab stays chat-centric**: returning chatters get an avatar
  highlight ring + click popover (dossier, stats, level); metrics fold into
  the goals strip (combined YouTube + Vids.Tube counts, click popover with
  per-platform charts); bingo is a mini-card (completed squares only), click
  to enlarge. Two-column layout on wide screens, no new tabs.
- **Bot action pattern**: every bot behavior gets an auto/suggest setting
  (like the existing mod-bot toggles): welcome-back, bingo completion, etc.
- **Commands**: `!me` slims to key stats + channel link (AI bio lives on the
  claimed channel page). `!rank`/`!top` report tonight's XP. `!goal` reports
  combined platform numbers. `!tts` is the first Credits sink. `!bingo` shows
  progress + card link. No `!link` command — linking is prompted contextually
  (in `!me` replies, on unclaimed channel pages, when signed in). `!vote`
  (AZ-153) is deferred but must ship with Credit boosts. Dragon commands are
  designed with the dragon game, not preemptively.
- **Dragon game** (eco3d): fish-tycoon model — breed, buy, sell multiple
  creatures across habitats (dragons first species). No care/training loop, no
  lineage system. Ownership transfers to chatters (Credits purchase or
  streamer gift) and grants print rights while the creature is alive.
  Creatures retire on a timer (print urgency; visible lifespan clock wherever
  a creature changes hands). Retired creatures leave a trophy record on the
  owner's profile. Rarity from genetics (allele frequency + rare morphs) and
  from shape (model variants) so it reads at a glance in 3 colors.
- **Print material**: PHA only, 3 colors (white, black, light brown), shown
  identically on screen and in print. No PLA, no painting. Constraint is the
  brand ("plant-based, compostable" — not "biodegradable").
- **Metrics**: streamer-facing first (/live panels + history); viewer-facing
  displays (e.g. a platform "race") deferred until data justifies them.
- **Voxel world game**: shelved. Design notes live in the 2026-07-25 session;
  revisit as a future overlay game only after the dragon game ships.

## The vids.tube track

### V0 — Pipeline trust (mostly complete, 2026-07-24/25)
- YouTube back-catalog fully archived: chat (`youtube_chat_archive`),
  transcripts (`youtube_transcripts`, auto-captions), view/like counts, and
  full VOD import into `videos` + synthetic `streams` rows (chat replay +
  transcripts work natively). Live capture is the source of truth going
  forward; backfill scripts are one-time tools.
- Finalize-script drift fixed and deployed to the VM.
- Remaining: AZ-104 (recording hook wrong-row matching), AZ-90 (orphaned
  preview session), AZ-157 smoke checklist next stream (start the worker
  BEFORE going live).

### V1 — Identity & the bridge
Channel/membership model + pooled-history merge; unclaimed channels for all
archived chatters with high-res avatars (URL size-token rewrite +
`channels.list` batch, cached to R2); claim flow (AZ-168 banner + contextual
prompts); slim `!me`; streamer recognition dossier (private Control Room
briefing cards from full chat history + transcripts); returning-chatter
welcome (auto/suggest); watch experience (persistent mini-player so
interactions never stop playback; one-tap fullscreen with YouTube parity).

### V2 — Overlay consolidation & streamer intelligence
Single-frame overlay + Preview-tab live editor + token + sounds; cut old URLs.
`stream_metrics` (worker samples per origin every 60s: concurrent viewers,
chat rate) + combined goals strip + per-platform popover charts + per-stream
history. AZ-167 quota calibration (10s chat poll floor, 4h + padding); the
quota-increase application (AZ-193) files early — as soon as AZ-30
(privacy policy + terms) ships, since the audit requires it — benefiting solo
streaming now and easing the later multi-streamer increase. Activity
chat-centric redesign.

### V3 — Play & economy
XP/Credits/Level ledger on memberships; streak flat bonus; `credit_cost` on
the command registry; `!tts` as first sink; bingo end-to-end (Settings
authoring with AI-suggested squares → Activity mini-card + approval →
overlay mark-off animation → `!bingo`); end-of-stream podium (top 3 +
personal-best callouts) as a wrap-up bot moment.

### V4 — Dragon game on stream (requires eco3d E4)
Habitat overlay element (one habitat at a time at the bottom of the stream);
chatter interactions designed in a dedicated design session alongside the
game; Credits-to-game valve (egg purchases, gifts); gifting flow with print
rights; hatch/reveal ceremonies as overlay moments.

### V5 — Creator toolkit & beyond
Clips/shorts editor from VODs with reaction-driven suggestions (AZ-119/120/
121/122); VOD subtitles (AZ-116); thumbnail generation; `!vote` with Credit
boosts; multi-streamer prep (AZ-31, AZ-108); monetization arc (AZ-36..42).

## The eco3d track (summary — detail in ../eco3d.shop/docs/roadmap.md)

E0 direction reset (park locomotion arc, retire old game) → E1 rig foundation
(keep STL segmentation + node-skeleton binding INCLUDING angle caps; delete
CPG/MuJoCo; simple pose-cycle animation; unify `model_configs` into
`dragon_models`) → E2 genetics v1 on PHA → E3 tycoon core (persistence, egg
market, breeding, selling, habitats, retirement, ownership/print rights) →
E4 integration API (unblocks V4) → E5 commerce (checkout, per-filament STL
export, fulfillment).

## Sync points

- V1–V3 have no eco3d dependency; E1–E3 have no vids.tube dependency — the
  tracks run fully in parallel until E4 → V4.
- Credits (V3) must exist before the Credits-to-game valve (V4).
- The dragon interaction design session gates both E3 finalization and V4.

## Foundations already in place

Vids.Tube: worker scoring/moderation loop, both-origin chat capture, live
transcription, complete pooled chat history to Aug-2025, full YouTube
VOD/chat/transcript archive, overlay stage + editor machinery, command
registry (cooldowns, per-stream disabling), `youtube_links` verify flow.

eco3d: rig studio (segment detection + skeleton binding + angle caps),
genetics schema + pure engine + admin authoring UIs, STL pipeline,
auth/admin gating.

## Open design items (do not ticket in detail yet)

Dragon stream-interaction design session (commands, overlay behavior, gifting
ceremony); in-game currency details (name, faucets, sinks, egg price tiers);
habitat rotation rules; bingo detection sensitivity; metrics popover chart
design.

# Vids.Tube Roadmap

Two-track build plan for Vids.Tube (this repo) and eco3d.shop (`../eco3d.shop`,
see its `docs/roadmap.md` for the E-track detail). Written 2026-07-26 after the
strategy sessions that settled the platform direction; phase status refreshed
2026-08-09. Future agents: read this document, then pick work from the Linear
backlog (Az team, Vids.Tube project) filtered to the current phase — ticket
titles carry phase labels like `[V1]`. Per CLAUDE.md governance, promote a
ticket into a new OpenSpec change before writing any code.

## Build position (2026-08-14)

V1 is code-complete and V3's economy core landed early, ahead of V2. Every
identity, membership, credit and greeting path exists in code; none of it has
been confirmed on a live broadcast, so the whole block is still gated behind one
streaming session and the run-sheet that drives it (AZ-222). V2 is the only
phase still holding unbuilt foundation work (`stream_metrics`, the Activity
redesign, the legal pages that unblock the quota application). The stream
timeline shipped out of phase order because the shorts workflow of V5 cannot be
designed without it.

Shipped 11-Aug to 14-Aug-2026, all on the /live page and its overlays: the
Overlays tab, which composes overlays against their real values through the same
renderer the OBS route uses; settings inherited from a previous broadcast, with
the thumbnail becoming an ordinary field that saves with everything else; the
members box renamed to the message banner, written as styled text in the banner
itself rather than as markup in a box beside it; and a metric per banner
message, drawn from nine live counts. The overlay registry landed in parallel,
giving a framed overlay an owner so a second streamer can be served.

Two things are true of all of it: none has been seen on a broadcast, and the
three per-broadcast counts have never returned a live number. The next broadcast
is what converts that.

Planned and unscheduled, recorded 14-Aug-2026 so that today's choices stay
additive: several framed overlays on one channel, a box the streamer can stretch
to any size and ratio, and an overlay declaring whether it accepts any shape or
wants its ratio held and the remainder letterboxed. What blocks each, and the one
thing that must never move into the host, is written in
`docs/overlay-platform.md` §7.

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
  editing happens on the /live Overlays tab (element toggles, position/scale,
  notification sounds/mute), against the overlays' real current values and
  through the same renderer the OBS route uses. Demo is a switch on that tab,
  and reaches OBS only when its checkbox is ticked. The Activity tab has its
  own separate demo toggle for simulated activity. Old per-element overlay URLs
  are removed, no transition period.
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
- AZ-104 + AZ-90 code shipped 2026-07-26 (recordedAt-based recording
  matching, stale-VOD reaper, preview title inheritance after a manual end);
  on-stream confirmation folded into the AZ-157 smoke checklist next stream
  (start the worker BEFORE going live).

### V1 — Identity & the bridge (code-complete 2026-08-09, unverified on stream)
Shipped: channel/membership model + pooled-history merge (AZ-169); unclaimed
channels for every archived chatter with high-res avatars; code-first claim
flow with the verify banner and contextual prompts; slim `!me`; the host as an
unscored participant (AZ-212); the returning-chatter welcome and the
first-message greeting, gated by a per-stream toggle; one player for live and
VOD with the chat held in place (AZ-197, AZ-198); membership on every first
message, so chatting alone makes someone a member.

Remaining in V1: the streamer recognition dossier (private Control Room
briefing cards from full chat history + transcripts).

Verification pending on a live broadcast: AZ-219 (onboarding, membership
updates, earning then spending), AZ-195 (identity merge on a real link
verification), AZ-201 (verify banner drives a real link), AZ-200 (unclaimed
channels and avatars on profile and overlay), AZ-221 (unified player), AZ-212
(host class), AZ-220 (bot replies chunked to 200 characters).

### V2 — Overlay consolidation & streamer intelligence (part shipped)
Single-frame overlay + Preview-tab live editor + token + sounds shipped
2026-07-26 (AZ-175/AZ-176; old URLs cut), pending first on-stream OBS
confirmation. The members strip shipped 2026-08-08: live member count, rank and
a join call to action, with its own opacity control.

Not yet built: `stream_metrics` (worker samples per origin every 60s:
concurrent viewers, chat rate) + combined goals strip + per-platform popover
charts + per-stream history; the Activity chat-centric redesign. AZ-167 quota
calibration (10s chat poll floor, 4h + padding); the quota-increase application
(AZ-193) files early — as soon as AZ-30 (privacy policy + terms) ships, since
the audit requires it — benefiting solo streaming now and easing the later
multi-streamer increase.

### V3 — Play & economy (economy core shipped early, games remain)
Shipped ahead of V2, because the members strip and the greeting needed real
numbers behind them: the XP/Credits/Level ledger on memberships, the recompute
that keeps the ledger honest, the level curve recalibrated to reward quality
over volume, and the streak flat bonus counting the broadcast currently on air.

`credit_cost` on the command registry and `!tts` as the first sink were listed
here as shipped from 2026-08-02 and had not been: the ledger's `spend_credits`
existed but nothing called it, no `credit_cost` column existed, and every one of
the 147 ledger lines in production was an earning. Both landed 2026-08-16, with
`!tts` priced at one credit and a five-credit grant on joining, so an arriving
chatter can be heard five times before earning anything. The earn-then-spend
path has never run during a live broadcast (AZ-219).

Not yet built: bingo end-to-end (Settings authoring with AI-suggested squares →
Activity mini-card + approval → overlay mark-off animation → `!bingo`);
end-of-stream podium (top 3 + personal-best callouts) as a wrap-up bot moment;
badge evaluation beyond the Day One award (AZ-225).

### V4 — The overlay platform, and the dragon game as tenant one
**Restated 14-Aug-2026.** This phase is no longer a bespoke dragon integration.
Vids.Tube becomes a general overlay-game platform: streamers browse a library,
toggle overlays, and configure them, and third-party overlays are an explicit
long-term goal. The dragon game from eco3d.shop is tenant one and gets no
privileges a stranger would not get. Full reasoning and the six locked decisions
are in `docs/overlay-platform.md`; the tenant side is in
`../eco3d.shop/docs/game-architecture.md`.

Foundation: an overlay registry; short-lived signed tokens naming overlay,
channel and an opaque per-channel viewer; settings stored per channel per
overlay as a blob the overlay owns, with the streamer-facing editor; the
two-way message channel and the SDK the frame loads; event routing by
subscription off the existing command registry; and replacing the single
build-time overlay address, which cannot serve two streamers, with a
per-channel frame carrying a token.

Deferred by decision, not by oversight: the wildcard subdomain and proxy, the
review flow, the permissions UI, and the public catalogue.

Then the game itself: chatter interactions, the Credits-to-game valve, gifting
with print rights, and hatch ceremonies as overlay moments.

### V5 — Creator toolkit & beyond (foundation shipped early)
The stream timeline shipped 2026-08-08 out of phase order (AZ-206), because the
shorts workflow cannot be designed without the map it produces: threads are
subjects with recurrences rather than topic blocks, so several spans about one
subject fuse into a single piece, and a tag marks only what departs from the
stream's steady state. Reviewing that pass and running the whole history
through it is AZ-209.

Not yet built: the Creator Studio umbrella (AZ-189) and under it the shorts
data model and studio editor (AZ-120), the shorts render pipeline in the worker
(AZ-121), the VOD editor (AZ-190), chapters (AZ-192) and thumbnails (AZ-191);
VOD subtitles (AZ-116); `!vote` with Credit boosts; multi-streamer prep (AZ-31,
AZ-108); monetization arc (AZ-36..42). VOD visibility control (public, private,
unlisted) enters here as the prerequisite for editing a published VOD.

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
registry (cooldowns, per-stream disabling), `youtube_links` verify flow,
channel/membership model with pooled-history merge, the credit ledger, the
automatic post-broadcast pass that turns a finished stream into complete
community data, and the stream timeline.

eco3d: rig studio (segment detection + skeleton binding + angle caps),
genetics schema + pure engine + admin authoring UIs, STL pipeline,
auth/admin gating.

## Open design items (do not ticket in detail yet)

Dragon stream-interaction design session (commands, overlay behavior, gifting
ceremony); in-game currency details (name, faucets, sinks, egg price tiers);
habitat rotation rules; bingo detection sensitivity; metrics popover chart
design.

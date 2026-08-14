## Context

The Game surface renders `components/overlay/game-window.tsx`, which reads `NEXT_PUBLIC_GAME_EMBED_URL`
and frames it. That address currently carries one streamer's whole game configuration in its query and
hash, so the same deployment cannot serve a second streamer, and the address is a deployment constant
rather than anything a channel owns.

The archived `overlay-game-window` capability made that deliberate: *"The framed address SHALL be read
from an environment value at build time. It SHALL NOT be read from the saved layout, from any database
row, or from the page's query string, so that no value written by a user is ever framed."* That reasoning
is sound and is preserved here. What changes is who "a user" means: an overlay's entry address is
authored by the overlay's owner and admitted to the registry, and is never written by a viewer or by a
streamer.

Surrounding facts that shape the design:

- The public overlay route is unauthenticated and gated by a per-channel `token` on `overlay_layouts`,
  read server-side through `supabaseAdmin`. Anything the frame needs follows that same path.
- `frame-src` in `next.config.ts` is built at build time from the origin of `NEXT_PUBLIC_GAME_EMBED_URL`.
  A registry row cannot widen it, and this change does not try to.
- The eco3d game reads `rig` and `legw` from its own link. Those stay exactly where they are, inside the
  overlay's authored entry address, until the token change replaces them.

## Goals / Non-Goals

**Goals:**

- An overlay is a row with an id and an owner, and the dragon game is row one rather than a special case.
- A channel installs an overlay, and that installation is the per-channel identity of the overlay.
- Two channels running the same overlay frame two different addresses.
- The guarantee that no viewer-written address is ever framed survives intact.

**Non-Goals:**

- **Declared origin lists and declared permissions are not stored.** Both are named in
  `docs/overlay-platform.md` §6, and neither is read by anything until the proxy and the permissions UI
  exist. Adding a column later is a migration; storing one now is forward implementation.
- No token, no signature, no opaque viewer id. The installation id is a plain unguessable row id here,
  and the next change replaces it in the URL with a signed token that names the same installation.
- No settings blob and no settings editor. Settings without a delivery channel is a table nothing reads,
  and delivery needs the frame handshake.
- No change to the Content-Security-Policy, and no change to any built-in overlay.
- No submission, review or catalogue flow. Registry rows are seeded by script until strangers exist.

## Decisions

### Two tables: `overlays` and `channel_overlays`

`overlays` is the registry. `channel_overlays` is the installation, unique on `(channel_id,
overlay_id)`, so the same overlay installs on many channels and a channel never installs one twice.

```
overlays
  id            uuid primary key
  slug          text unique, lowercase, [a-z0-9-]
  name          text
  owner_user_id uuid references auth.users, nullable
  entry_url     text
  status        text in ('draft', 'published', 'disabled')

channel_overlays
  id            uuid primary key          -- the per-channel identity of this overlay
  channel_id    uuid references channels on delete cascade
  overlay_id    uuid references overlays  on delete cascade
  enabled       boolean not null default true
  unique (channel_id, overlay_id)
```

`owner_user_id` is nullable because the first row is seeded before any developer account exists, and a
first-party overlay has no third-party owner. It is not a placeholder for a missing decision: an overlay
with no owner row is a first-party overlay.

Alternative rejected: one table with a nullable `channel_id`, which conflates "this overlay exists" with
"this channel runs it" and makes the unique constraint unstateable.

### The framed origin stays build-time; the path comes from the registry

`game-window.tsx` frames `entry_url` from the installed overlay, with the installation id appended as a
query parameter, but only when the origin of `entry_url` equals the origin of
`NEXT_PUBLIC_GAME_EMBED_URL`. A mismatch renders nothing and logs with `console.error`.

This keeps every property the archived requirement was protecting. The origin is still a build-time
constant, so a compromised or careless registry row cannot cause a foreign origin to be framed, and it
cannot silently disagree with `frame-src` and produce a blocked frame that looks like a rendering bug.
The path and query become per-channel, which is the whole point of the change.

Alternative rejected: reading the origin from the registry and computing `frame-src` per request. That
requires the policy to be per-response rather than per-build, which is the proxy work, deferred by
decision in `docs/overlay-platform.md` §5.

### The installation id is carried as `install`, appended rather than replacing

The host appends `install=<channel_overlays.id>` to whatever query the authored `entry_url` already
carries. It does not rewrite or interpret the rest of the address.

Appending is what lets the dragon game keep working unchanged through this change: its `rig` and `legw`
parameters ride along untouched, and the eco3d side needs no edit. The next change removes them in favour
of what the token carries.

The row id is a v4 uuid, so it is unguessable, carries no meaning, and is stable for the life of the
installation. It is not a secret and grants nothing on its own; it is a name, and the token that follows
is what will grant.

### "Not installed" and "not yet known" are different states

`gameInstallation` is `OverlayInstallation | null | undefined`: undefined while the query is in flight,
null once the answer is known to be nothing. The renderer logs the empty box only for null.

Found by observation rather than by reasoning. Collapsing the two with `?? null` made every page load
report `game window shown but no overlay is installed on this channel` twice before the frame appeared,
which turns a real diagnostic into noise that would be ignored when it finally mattered.

### The registry is seeded by a script, not by a migration

A migration cannot read `NEXT_PUBLIC_GAME_EMBED_URL`, and the first row's entry address is exactly that
value. `scripts/seed-dragon-overlay.ts` inserts the registry row and installs it on the owner's channel,
idempotently on the slug.

Alternative rejected: hardcoding the address in the migration, which puts one deployment's configuration
into version control and into every other deployment's database.

### Row level security follows the existing channel-owned pattern

`overlays`: published rows are readable by anyone, matching how `chat_commands` exposes enabled rows.
Writes go through owner-checked server actions on the service role.

`channel_overlays`: readable and writable by the channel owner only, by the same `channels.owner_user_id =
auth.uid()` existence check `command_events` uses. The public overlay route reads it through
`supabaseAdmin` behind the layout token, exactly as it reads the layout itself.

### The Overlays tab gains an install list

The install control lists published overlays with an install or uninstall action per row, in the existing
overlay control panel. It is the streamer-facing half of "a channel installs an overlay", and without it
the registry is reachable only by SQL.

## Risks / Trade-offs

- **The Game box renders nothing until an overlay is installed, so the owner's working overlay goes blank
  on deploy** → the seed script installs on the owner's channel in the same step, and the change is not
  finished until a capture of the overlay route shows the frame back.
- **An `entry_url` whose origin drifts from the build-time origin fails silently to the audience** →
  the mismatch is logged with `console.error`, and the install list marks a row whose origin is not
  permitted so the streamer sees why nothing renders.
- **The installation id appears in the OBS browser source URL and is visible to anyone the streamer shows
  their source to** → it names an installation and grants nothing, and the next change makes the granting
  credential a short-lived signed token rather than this id.
- **Two active changes already exist in this repository from other work** → this change touches no file
  they touch, and its files are staged by name rather than by committing the tree.

## Migration Plan

1. Push the migration creating both tables with their policies. Nothing reads them yet, so this is safe
   on its own.
2. Run the seed script against the remote database, creating the dragon overlay row and installing it on
   the owner's channel.
3. Deploy the render change. The Game box switches from the environment variable to the installation in
   the same deploy.

Rollback is a revert of the render change; the tables can stay, unread.

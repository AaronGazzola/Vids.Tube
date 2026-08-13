# Live Streaming VM Runbook

How to provision the Hetzner VM that ingests your OBS RTMP stream, remuxes it to
low-latency HLS, and serves it to viewers — and how it talks to the vids.tube app.

This is owner-run infrastructure. The app side (ingest hook routes, player, chat,
viewer cap) is already built and deployed; this runbook stands up the VM that
feeds it. It reflects the **as-built** deployment (nginx + LL-HLS).

## Overview

```
OBS ──RTMP──► MediaMTX (:1935 ingest, :8888 HLS, :8889 WebRTC)
                 │  publish auth ─► POST https://vids.tube/api/ingest/auth
                 │  on-ready loop ─► POST https://vids.tube/api/ingest/live?path=<slug>[&ladder=1]
                 │  on-not-ready ──► POST https://vids.tube/api/ingest/offline?path=<slug>
                 │
                 ├─ mtx-ladder.sh: ONE ffmpeg reads <slug> over loopback and writes
                 │  all three renditions into /var/lib/vids-tube/hls/<slug>/ —
                 │  1080x1920 copied, 720x1280 @2.5M, 540x960 @1.2M, one master
                 ▼
              nginx (:443 TLS, reverse proxy, proxy_buffering off, conn cap)
                 ├─ /<slug>/index.m3u8      ─► MediaMTX LL-HLS, single rendition, ~1–3s
                 └─ /ladder/<slug>/…        ─► static files from the ladder, ~3–4s
                                               master.m3u8 lists stream_540/720/1080
```

- **MediaMTX** accepts RTMP, authenticates the publish via the app, **remuxes**
  to **Low-Latency HLS** (no transcode — OBS sends H.264/AAC, any aspect ratio),
  fires the live/offline hooks, and records the session for the VOD. Every path
  is publishable only with a stream key; nothing on this machine publishes into
  MediaMTX except the encoder.
- **The ladder** gives a viewer whose bandwidth dips somewhere to drop to instead
  of stalling. **One ffmpeg produces all three renditions into one HLS output**,
  so every rendition shares a clock and their segments start at the same
  instants. The publisher's own picture is copied, not re-encoded, and the VOD is
  still recorded from MediaMTX's copy of it. Audio is copied onto all three, so
  switching cannot glitch the sound.
- **nginx** terminates TLS for `stream.vids.tube`, reverse-proxies MediaMTX's HLS
  port with **buffering off** (so LL-HLS parts stream through), serves the
  ladder's files statically, and caps concurrent connections as the cost
  backstop. (We use nginx rather than Caddy for `limit_conn` / `limit_rate`.)
- **Latency depends on which address a viewer is on.** MediaMTX's low-latency
  HLS runs at ~1–3s and is what a broadcast records while the ladder is off. The
  ladder runs at **~3–4s**, because ffmpeg's HLS muxer has no `EXT-X-PART`
  support and therefore no low-latency mode. That ~2s was traded deliberately on
  10-Aug-2026: stalling costs a viewer more than lag does, and chat is on
  Vids.Tube rather than on the video. This is not a fault to chase.
- WebRTC (sub-second) is also exposed on `:8889` (WHEP) as a future option if you
  want true real-time.

## Prerequisites

- A Hetzner Cloud VM, Ubuntu 24.04+. **2 vCPU / 4 GB is enough, including the
  quality ladder.** Measured 10-Aug-2026 on the as-built machine against a real
  recording: both rungs together cost **0.50 of a core at 2.1x real time**; a
  single 720x1280 rung costs 0.35. An earlier estimate of "roughly two cores"
  was wrong by about fourfold and had a resize planned around it, so do not size
  up on the assumption that transcoding needs it. If a broadcast ever does
  exhaust the machine, drop to the single rung before buying cores — and if you
  do buy, note that sustained encoding belongs on a dedicated-vCPU plan rather
  than a bigger shared one.
- DNS control for `vids.tube`.
- The two app secrets, already present in the Doppler **`prd`** config (Vercel
  pulls from `prd`); the VM must use the **same** `INGEST_SHARED_SECRET`:
  - `INGEST_SHARED_SECRET` — sent in the `x-ingest-secret` header on the live/
    offline hooks. Read it: `doppler secrets get INGEST_SHARED_SECRET --project vids-tube --config prd --plain`.
  - `NEXT_PUBLIC_STREAM_HOST` = `https://stream.vids.tube` (the live hook builds
    HLS URLs from it; the Studio page shows the RTMP URL from it).

## 1. DNS

Create an A record (DNS-only / not proxied if on Cloudflare):

```
stream.vids.tube  →  <VM public IPv4>
```

Wait for it to resolve before requesting TLS certs.

## 2. Base packages

```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx ffmpeg curl tar jq
```

## 3. MediaMTX

Install the latest release binary:

```bash
VER=$(curl -s https://api.github.com/repos/bluenviron/mediamtx/releases/latest | jq -r .tag_name)
cd /tmp && curl -sL -o m.tar.gz \
  https://github.com/bluenviron/mediamtx/releases/download/$VER/mediamtx_${VER}_linux_amd64.tar.gz
tar xzf m.tar.gz && install -m 0755 mediamtx /usr/local/bin/mediamtx && mkdir -p /usr/local/etc
```

Hook scripts (kept as files to avoid YAML quoting pitfalls). They inherit
`INGEST_SHARED_SECRET` from the service env and `MTX_PATH` from MediaMTX:

The live hook carries `&ladder=1` **only while a ladder is actually being
produced** — the transcoder's pid file and the channel's master playlist both
have to exist. That is what decides whether a broadcast records the master
playlist or the single-rendition address, so the app can never hand viewers a
manifest this machine is not producing.

The check is re-run on **every heartbeat**, not once at go-live. A broadcast's
recorded address therefore self-corrects within 30s: if the transcoder never
starts or dies for good, the next heartbeat drops the flag and viewers are put
back on MediaMTX's single-rendition playlist. Playback degrades rather than
breaks.

```bash
cat > /usr/local/bin/mtx-live.sh <<'SH'
#!/usr/bin/env bash
nohup /usr/local/bin/mtx-ladder.sh "${MTX_PATH}" >>/var/log/vids-tube-ladder.log 2>&1 &
while true; do
  LADDER_QS=""
  if [ -f "/run/vids-tube-ladder-${MTX_PATH}.pid" ] && [ -f "/var/lib/vids-tube/hls/${MTX_PATH}/master.m3u8" ]; then
    LADDER_QS="&ladder=1"
  fi
  curl -s -o /dev/null -X POST -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" "https://vids.tube/api/ingest/live?path=${MTX_PATH}${LADDER_QS}"
  sleep 30
done
SH
cat > /usr/local/bin/mtx-notready.sh <<'SH'
#!/usr/bin/env bash
/usr/local/bin/mtx-ladder-stop.sh "${MTX_PATH}" || true
curl -s -o /dev/null -X POST -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" "https://vids.tube/api/ingest/offline?path=${MTX_PATH}"
nohup /usr/local/bin/mtx-finalize-vod.sh "${MTX_PATH}" >>/var/log/vids-tube-finalize.log 2>&1 &
SH
chmod +x /usr/local/bin/mtx-live.sh /usr/local/bin/mtx-notready.sh
```

Deploy the ladder scripts from the repo (`scripts/vm/`) and write the master
playlist once per channel. The master is a static per-channel file; the
transcoder writes the rendition playlists and segments beside it and refuses to
start if the master is missing:

```bash
install -m 0755 mtx-ladder.sh mtx-ladder-stop.sh /usr/local/bin/
mkdir -p /var/lib/vids-tube/hls/owner
# from a checkout of the app repo:
npx tsx scripts/vm/write-master-playlist.ts --path owner
```

Prove the packaging before turning anything on. This runs the real transcoder
against a synthetic 1080x1920 source with a known keyframe cadence and checks
that all three renditions advance, share segment boundaries and carry identical
audio. It touches neither MediaMTX nor production:

```bash
# on the streaming machine, once the scripts and the master playlist are installed:
sh /usr/local/bin/verify-ladder.sh
```

It needs **ffmpeg and nothing else** there. The master playlist is static per
channel, so rather than regenerating one the script uses the installed
`/var/lib/vids-tube/hls/<channel>/master.m3u8` — the exact file production
serves, which makes the master-references-real-playlists check meaningful rather
than circular. Point `LADDER_MASTER` at a specific file to override the choice.

From a checkout instead, with no channel installed, it falls back to generating
the master playlist with `npx tsx` and runs the same way:

```bash
sh scripts/vm/verify-ladder.sh
```

That covers packaging only. Confirm the lifecycle **on this machine**, because it
depends on signals reaching the transcoder's process group: after the run,
`pgrep -af ffmpeg` must return nothing and `/var/lib/vids-tube/hls/<slug>/` must
hold `master.m3u8` and nothing else. A transcode left running between broadcasts
is the expensive failure on a 2 vCPU box.

**The ladder is on by default.** Installing these scripts and restarting MediaMTX
is what turns it on; there is no second step. A viewer who cannot hold 5 Mbps is
the normal case, so the ladder is the normal configuration.

**Turning it off is `LADDER_ENABLED=0`** in the MediaMTX service environment plus
`systemctl restart mediamtx`. The transcoder then never starts, so its pid file
never appears, so the live hook stops flagging a ladder and new broadcasts record
the single-rendition address again with latency back at ~1–3s. Broadcasts already
recorded are unaffected either way.

The ladder is off for a channel until its master playlist is written, because the
transcoder refuses to start without one and the live hook only flags a ladder it
can see. Adding a channel therefore means writing its master playlist, and
forgetting to degrades that channel to today's playback rather than breaking it.

Watching the machine's load and the real latency through the first broadcast that
runs the ladder is AZ-250.

Config `/usr/local/etc/mediamtx.yml`:

```yaml
rtmp: yes
rtmpAddress: :1935

# Low-Latency HLS (fMP4 parts + blocking playlist reload).
hls: yes
hlsAddress: :8888
hlsVariant: lowLatency
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
hlsAlwaysRemux: no

# Authenticate every action against the app (only publish is key-checked).
authMethod: http
authHTTPAddress: https://vids.tube/api/ingest/auth

paths:
  # One path per channel slug. The owner channel's slug is "owner".
  owner:
    # Heartbeat refreshes streams.last_seen_at every 30s so the app's 60s
    # staleness guard keeps it "live"; MediaMTX kills this loop on not-ready.
    runOnReady: /usr/local/bin/mtx-live.sh
    runOnReadyRestart: yes
    runOnNotReady: /usr/local/bin/mtx-notready.sh
    # Record the session for VOD (remux, no transcode). A long segment duration
    # makes each session a single file, so finalize is a trivial remux. See §8.
    record: yes
    recordPath: /var/lib/vids-tube/rec/%path/%Y-%m-%d_%H-%M-%S-%f
    recordFormat: fmp4
    recordSegmentDuration: 24h
```

There are **no rendition paths**. The ladder writes files, so nothing publishes
into MediaMTX except the encoder, and every path stays publishable only with a
stream key. An earlier attempt republished each rung into its own MediaMTX path;
it left the rungs half a second out of phase with the source and needed a
loopback exception in publish authentication. Both are gone. Do **not** add
`authHTTPExclude` for anything here.

systemd unit `/etc/systemd/system/mediamtx.service` (secret in the env, never in
the config file or image):

```ini
[Unit]
Description=MediaMTX
After=network.target

[Service]
Environment=INGEST_SHARED_SECRET=<paste prd value>
# The quality ladder is on by default. Add Environment=LADDER_ENABLED=0 here to
# turn it off: no transcoding, and broadcasts record the single-rendition
# address, exactly as before the ladder existed.
ExecStart=/usr/local/bin/mediamtx /usr/local/etc/mediamtx.yml
Restart=always
RestartSec=2
User=root

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now mediamtx
```

**How auth works:** on publish, MediaMTX POSTs JSON to `/api/ingest/auth` with
`action`, `path`, and `query`. The app reads the key from the query string
(`?key=...`) and checks it against `stream_keys`. Reads (viewers) return 200; only
`publish` is key-checked.

## 4. nginx (TLS + buffering off + connection cap)

```bash
certbot --nginx -d stream.vids.tube --non-interactive --agree-tos -m <you@example.com> --redirect
```

Site config `/etc/nginx/sites-available/stream.vids.tube` (certbot adds the 443
listen + cert lines):

```nginx
limit_conn_zone $server_name zone=hlscap:10m;

server {
    listen 80;
    server_name stream.vids.tube;

    # The quality ladder, served as static files written by mtx-ladder.sh. This
    # is a separate address space from the MediaMTX proxy below, so the
    # single-rendition address every earlier broadcast recorded is untouched and
    # turning the ladder off changes nothing here.
    location /ladder/ {
        alias /var/lib/vids-tube/hls/;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Cache-Control "no-cache" always;   # playlists change every segment
        types {
            application/vnd.apple.mpegurl m3u8;
            video/iso.segment            m4s;
            video/mp4                    mp4;
        }
        default_type application/vnd.apple.mpegurl;
    }

    location / {
        limit_conn hlscap 120;     # LL-HLS holds requests open longer; headroom
        limit_rate 1500k;           # per-response bandwidth cap (>> stream bitrate)
        proxy_hide_header Access-Control-Allow-Origin;       # drop MediaMTX's reflected Origin
        proxy_hide_header Access-Control-Allow-Credentials;  # drop MediaMTX's credentials flag
        add_header Access-Control-Allow-Origin "*" always;   # serve a clean public-HLS CORS
        proxy_pass http://127.0.0.1:8888;
        proxy_buffering off;        # required so LL-HLS parts stream through
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

```bash
ln -sf /etc/nginx/sites-available/stream.vids.tube /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Notes:
- **Normalize CORS in nginx (AZ-92).** MediaMTX (v1.18.x) does **not** serve a
  plain `Access-Control-Allow-Origin: *` — it reflects the request `Origin`
  verbatim **and** sends `Access-Control-Allow-Credentials: true`, which is an
  invalid combination for public content. nginx therefore strips both upstream
  headers (`proxy_hide_header`) and serves a single clean
  `Access-Control-Allow-Origin: *` (no credentials) for this public HLS endpoint.
  Verify: `curl -I -H "Origin: https://evil.com" https://stream.vids.tube/<path>`
  must return `Access-Control-Allow-Origin: *` and **no** `Allow-Credentials`.
- `limit_conn` + `limit_rate` bound worst-case egress (the cost backstop behind
  the app's soft 25-viewer cap). LL-HLS holds connections longer, hence 120.

## 5. Firewall

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 1935/tcp
ufw --force enable
```

If your studio IP is static, restrict 1935 to it instead:
`ufw allow from <your-ip> to any port 1935 proto tcp`.

SSH hardening (AZ-93): port 22 is left open to any IP (the admin IP is dynamic),
but brute force is mitigated by **fail2ban** and **key-only auth**:

```bash
# key-only SSH (drop-in survives sshd_config rewrites)
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\n' \
  > /etc/ssh/sshd_config.d/99-hardening.conf
sshd -t && systemctl reload ssh

# fail2ban: ban after 5 failures in 10m, for 1h
apt-get install -y fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
EOF
systemctl enable --now fail2ban
fail2ban-client status sshd
```

## 6. OBS

- **Service:** Custom
- **Server:** `rtmp://stream.vids.tube:1935`
- **Stream Key:** `owner?key=<KEY>` — the channel slug plus the key from
  Studio → Go live (OBS joins Server + `/` + Stream Key, so MediaMTX sees path
  `owner` + query `key=...`).
- **Output:** H.264 + AAC, CBR ~4500 kbps. For lowest latency set **Keyframe
  Interval = 1s** (Advanced output mode). Vertical (9:16) and wide (16:9) both
  work — set the canvas dimensions accordingly.
- **Audio:** remux passes your audio through untouched, so set levels in OBS — add
  a **Gain** (+10–20 dB) and **Compressor** (with makeup gain) filter on the mic
  if it's quiet.
- **Simulcast to YouTube:** keep YouTube as the main Stream service (signed in)
  and add `vids.tube` as a second target via the `obs-multi-rtmp` (or Aitum)
  plugin. You pay ~2× upload bandwidth. Monitor YouTube in YouTube Studio and
  vids.tube by opening the site.

## 7. Pipeline smoke test

With nothing live, the app home/`/live` shows "No live stream right now".

1. Push a test pattern as a detached unit (survives the SSH session):

   ```bash
   systemd-run --unit=smoketest ffmpeg -re \
     -f lavfi -i testsrc=size=1280x720:rate=30 -f lavfi -i sine=frequency=1000 \
     -c:v libx264 -preset veryfast -tune zerolatency -g 30 -pix_fmt yuv420p \
     -c:a aac -f flv "rtmp://localhost:1935/owner?key=<KEY>"
   ```

2. The `streams` row flips to `live` and the player starts. The HLS master at
   `https://stream.vids.tube/owner/index.m3u8` (302-redirects to a session
   playlist — hls.js follows it) lists a low-latency media playlist with
   `EXT-X-PART` chunks and `CAN-BLOCK-RELOAD=YES`.
3. Stop and confirm offline: `systemctl stop smoketest` → not-ready hook fires →
   `streams.status = ended`, HLS → 404.

If go-live doesn't register, check: the VM's `INGEST_SHARED_SECRET` matches the
`prd` value; `/api/ingest/auth` returns 200 for the publish; nginx proxies
`:8888`; and the OBS stream key matches Studio → Go live.

## 8. VOD recording & upload (R2)

When a stream ends, the app's `offline` hook creates a `videos` row in
`processing`; this VM step finalizes the recording, uploads it to R2, and calls
`/api/ingest/recording` to flip the row to `ready`. VODs are then served free
from `https://cdn.vids.tube` (zero egress).

### 8.1 R2 credentials

```bash
install -d -m 700 /etc/vids-tube
cat > /etc/vids-tube/r2.env <<EOF
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<access key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_VOD=vids-tube-vod
EOF
chmod 600 /etc/vids-tube/r2.env
```

### 8.2 rclone remote for R2

```bash
apt-get install -y rclone
set -a; . /etc/vids-tube/r2.env; set +a
mkdir -p /root/.config/rclone
cat > /root/.config/rclone/rclone.conf <<EOF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${R2_ACCESS_KEY_ID}
secret_access_key = ${R2_SECRET_ACCESS_KEY}
endpoint = https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
no_check_bucket = true
EOF
rclone lsd r2:${R2_BUCKET_VOD}   # sanity check: should not error
```

**`no_check_bucket = true` is required.** The R2 API token is scoped to the
`vids-tube-vod` bucket, so rclone's default pre-upload bucket-existence check
(a bucket-level op) returns `403 AccessDenied` and every upload fails — even
though listing and object PUTs are permitted. Skipping the check fixes it. (Do
not set `acl`; R2's token-scoped uploads don't need it.)

Note: the first upload attempt logs a transient `501 NotImplemented` and rclone
succeeds on the retry. It fails fast (before sending the file body), so it costs
a round-trip, not re-uploaded bytes — harmless.

### 8.3 Finalize script

`runOnNotReady` (§3) launches this in the background on every encoder disconnect.
It asks the app (`GET /api/ingest/recording?path=<slug>&recordedAt=<session start>`)
for the session's `liveAt` and `ended` flags. A broadcast that never went live (no
`liveAt`) produces **no VOD**. Otherwise it **concatenates every recorded segment
since go-live** — a broadcast that disconnected and reconnected leaves one file per
encoder session — trimming the first segment to start at `liveAt` (excluding the
private preview footage) and appending each reconnect segment whole. The result is a
single faststart MP4 with a **jump cut** (no black) at each reconnect. It posts the
result on every disconnect, but the app keeps the VOD hidden (`processing`) until
the owner presses **End stream**; only then does the row flip to `ready`. The raw
segments are deleted only once the broadcast has `ended`, so a reconnect can always
re-finalize with the added footage. The script also captures pixel dimensions
(`ffprobe`),
grabs a poster thumbnail at `min(10s, dur/2)`, extracts 5 hover-preview stills
(~480px wide at 5%/25%/45%/65%/85% of the duration), uploads everything to R2
under `vod/<slug>/<ts>.{mp4,jpg}` and `vod/<slug>/<ts>/preview-<n>.jpg`, then
notifies the app. On any hard failure it exits non-zero and the `videos` row
stays `processing` (never shown). Dimension-probe and individual preview-still
failures are **soft** — the script logs and continues.

The dimension probe is **rotation-aware**: `ffprobe` returns *coded* dimensions
that ignore rotation metadata, so the script reads the stream rotation
(`stream_side_data=rotation`, falling back to the legacy `stream_tags=rotate`)
and swaps width/height for a ±90° turn, reporting the *displayed* orientation.
A portrait phone capture is frequently a rotated landscape raster, so without
this swap a vertical VOD would be published as landscape. This only affects
VODs recorded after the VM is updated to this version of the script; existing
rows keep their stored (or null) dimensions, and the player still derives
orientation from the video's intrinsic size at render time.

The script lives in the repo at [`scripts/vm/mtx-finalize-vod.sh`](../../scripts/vm/mtx-finalize-vod.sh)
so it stays in version control. Install it on the VM with:

```bash
apt-get install -y jq
install -m 0755 scripts/vm/mtx-finalize-vod.sh /usr/local/bin/mtx-finalize-vod.sh
```

(`jq` is a new dependency — it builds the JSON payload sent to the recording
hook. Earlier VMs that pre-date this change already have ffmpeg installed; jq
is the only additional package.)

`INGEST_SHARED_SECRET` is inherited from the MediaMTX service env (§3). After
editing configs: `systemctl restart mediamtx`.

### 8.4 Retention & manual re-run

- The source fMP4 is deleted on a successful upload; the finalized MP4 is kept
  under `/var/lib/vids-tube/out/<slug>/` as a safety copy — prune it on a
  schedule (e.g. `find /var/lib/vids-tube/out -mtime +7 -delete`).
- If a VOD is stuck `processing` (finalize failed — see
  `/var/log/vids-tube-finalize.log`), fix the cause and re-run manually:
  `/usr/local/bin/mtx-finalize-vod.sh owner`.

### 8.5 VOD smoke test

After the live smoke test (§7), stopping the stream should: fire the offline
hook (`videos` row → `processing`), then within a few seconds the finalize log
shows the upload and the row flips to `ready`. Confirm:

- `rclone ls r2:vids-tube-vod/vod/owner/` lists the `.mp4` + `.jpg`.
- The channel page (`/owner`) lists the new VOD; opening it plays and seeks from
  `https://cdn.vids.tube`.

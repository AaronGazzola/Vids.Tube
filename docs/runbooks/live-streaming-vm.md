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
                 │  on-ready loop ─► POST https://vids.tube/api/ingest/live?path=<slug>   (every 30s)
                 │  on-not-ready ──► POST https://vids.tube/api/ingest/offline?path=<slug>
                 ▼
              nginx (:443 TLS, reverse proxy, proxy_buffering off, conn cap)
                 ▼
        https://stream.vids.tube/<slug>/index.m3u8 ──► viewers (hls.js, LL-HLS)
```

- **MediaMTX** accepts RTMP, authenticates the publish via the app, **remuxes**
  to **Low-Latency HLS** (no transcode — OBS sends H.264/AAC, any aspect ratio),
  and fires the live/offline hooks.
- **nginx** terminates TLS for `stream.vids.tube`, reverse-proxies MediaMTX's HLS
  port with **buffering off** (so LL-HLS parts stream through), and caps
  concurrent connections as the cost backstop. (We use nginx rather than Caddy for
  `limit_conn` / `limit_rate`.)
- Latency is ~1–3s. WebRTC (sub-second) is also exposed on `:8889` (WHEP) as a
  future option if you want true real-time.

## Prerequisites

- A Hetzner Cloud VM (CPX21/CPX22 is ample for remux-only), Ubuntu 24.04+.
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

```bash
cat > /usr/local/bin/mtx-live.sh <<'SH'
#!/usr/bin/env bash
while true; do
  curl -s -o /dev/null -X POST -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" "https://vids.tube/api/ingest/live?path=${MTX_PATH}"
  sleep 30
done
SH
cat > /usr/local/bin/mtx-notready.sh <<'SH'
#!/usr/bin/env bash
curl -s -o /dev/null -X POST -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" "https://vids.tube/api/ingest/offline?path=${MTX_PATH}"
nohup /usr/local/bin/mtx-finalize-vod.sh "${MTX_PATH}" >>/var/log/vids-tube-finalize.log 2>&1 &
SH
chmod +x /usr/local/bin/mtx-live.sh /usr/local/bin/mtx-notready.sh
```

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

systemd unit `/etc/systemd/system/mediamtx.service` (secret in the env, never in
the config file or image):

```ini
[Unit]
Description=MediaMTX
After=network.target

[Service]
Environment=INGEST_SHARED_SECRET=<paste prd value>
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

    location / {
        limit_conn hlscap 120;     # LL-HLS holds requests open longer; headroom
        limit_rate 1500k;           # per-response bandwidth cap (>> stream bitrate)
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
- **Do not add an `Access-Control-Allow-Origin` header in nginx** — MediaMTX
  already serves `Access-Control-Allow-Origin: *` on HLS responses; a second one
  would break CORS.
- `limit_conn` + `limit_rate` bound worst-case egress (the cost backstop behind
  the app's soft 25-viewer cap). LL-HLS holds connections longer, hence 120.

## 5. Firewall

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 1935/tcp
ufw --force enable
```

If your studio IP is static, restrict 1935 to it instead:
`ufw allow from <your-ip> to any port 1935 proto tcp`.

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
acl = private
EOF
rclone lsd r2:${R2_BUCKET_VOD}   # sanity check: should not error
```

### 8.3 Finalize script

`runOnNotReady` (§3) launches this in the background. It remuxes the session
recording to a single faststart MP4, grabs a thumbnail at `min(10s, dur/2)`,
uploads both under `vod/<slug>/<ts>.{mp4,jpg}`, then notifies the app. On any
failure it exits non-zero and the `videos` row stays `processing` (never shown).

```bash
cat > /usr/local/bin/mtx-finalize-vod.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
SLUG="$1"
set -a; . /etc/vids-tube/r2.env; set +a

REC_DIR="/var/lib/vids-tube/rec/${SLUG}"
SRC="$(ls -t ${REC_DIR}/*.mp4 2>/dev/null | head -1 || true)"
[ -z "${SRC:-}" ] && { echo "no recording for ${SLUG}"; exit 0; }

TS="$(date +%s)"
OUT="/var/lib/vids-tube/out/${SLUG}"; mkdir -p "$OUT"
MP4="${OUT}/${TS}.mp4"; JPG="${OUT}/${TS}.jpg"

ffmpeg -y -i "$SRC" -c copy -movflags +faststart "$MP4"
DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP4" | cut -d. -f1)"
[ -z "${DUR:-}" ] && DUR=0
SEEK=$(( DUR < 20 ? DUR/2 : 10 ))
ffmpeg -y -ss "$SEEK" -i "$MP4" -frames:v 1 "$JPG"

KEY_MP4="vod/${SLUG}/${TS}.mp4"; KEY_JPG="vod/${SLUG}/${TS}.jpg"
rclone copyto "$MP4" "r2:${R2_BUCKET_VOD}/${KEY_MP4}"
rclone copyto "$JPG" "r2:${R2_BUCKET_VOD}/${KEY_JPG}"

curl -fsS -o /dev/null -X POST \
  -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" \
  -H "content-type: application/json" \
  -d "{\"mp4Path\":\"${KEY_MP4}\",\"thumbnailPath\":\"${KEY_JPG}\",\"durationS\":${DUR}}" \
  "https://vids.tube/api/ingest/recording?path=${SLUG}"

rm -f "$SRC"
SH
chmod +x /usr/local/bin/mtx-finalize-vod.sh
```

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

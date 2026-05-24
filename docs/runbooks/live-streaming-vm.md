# Live Streaming VM Runbook

How to provision the Hetzner VM that ingests your OBS RTMP stream, remuxes it to
HLS, and serves it to viewers — and how it talks to the vids.tube app.

This is owner-run infrastructure. The app side (ingest hook routes, player, chat,
viewer cap) is already built and deployed; this runbook stands up the VM that
feeds it.

## Overview

```
OBS ──RTMP──► MediaMTX (:1935 ingest, :8888 HLS)
                 │  publish auth ─► POST https://vids.tube/api/ingest/auth
                 │  on-ready loop ─► POST https://vids.tube/api/ingest/live?path=<slug>
                 │  on-not-ready ──► POST https://vids.tube/api/ingest/offline?path=<slug>
                 ▼
              nginx (:443 TLS, reverse proxy + bandwidth backstop)
                 ▼
        https://stream.vids.tube/<slug>/index.m3u8 ──► viewers (hls.js)
```

- **MediaMTX** accepts RTMP, authenticates the publish via the app, remuxes to
  HLS (no transcode — OBS sends 720p H.264/AAC), and fires the live/offline hooks.
- **nginx** terminates TLS for `stream.vids.tube`, reverse-proxies MediaMTX's HLS
  port, and applies a connection + bandwidth cap as the hard cost backstop. (We
  use nginx rather than Caddy specifically for `limit_conn` / `limit_rate`.)

## Prerequisites

- A Hetzner Cloud VM (e.g. CCX13, dedicated CPU), Ubuntu 22.04+.
- DNS control for `vids.tube`.
- The two app secrets from Doppler (`vids-tube` / matching config):
  - `INGEST_SHARED_SECRET` — the value the app expects in the `x-ingest-secret`
    header. Read it: `doppler secrets get INGEST_SHARED_SECRET --plain`.
  - `NEXT_PUBLIC_STREAM_HOST` — must equal `https://stream.vids.tube` (the app
    builds HLS URLs from this and shows the RTMP URL from it).

## 1. DNS

Create an A record:

```
stream.vids.tube  →  <VM public IPv4>
```

Wait for it to resolve before requesting TLS certs.

## 2. Firewall

Allow only what's needed:

```bash
ufw allow 22/tcp        # ssh
ufw allow 443/tcp       # HLS over TLS (nginx)
ufw allow 80/tcp        # ACME http-01 challenge for certbot
ufw allow 1935/tcp      # RTMP ingest (restrict to your streaming IP if static)
ufw enable
```

If your home/studio IP is static, restrict 1935 to it:
`ufw allow from <your-ip> to any port 1935 proto tcp`.

## 3. MediaMTX

Download the latest release from https://github.com/bluenviron/mediamtx/releases
and install it as a service. Key parts of `/usr/local/etc/mediamtx.yml`:

```yaml
# Global RTMP + HLS
rtmp: yes
rtmpAddress: :1935

hls: yes
hlsAddress: :8888
hlsVariant: mpegts
hlsAlwaysRemux: no

# Authenticate every action against the app.
authMethod: http
authHTTPAddress: https://vids.tube/api/ingest/auth

paths:
  # One path per channel slug. The owner channel's slug is "owner".
  owner:
    # Refresh last_seen_at every 30s while live so the app's staleness guard
    # (60s) keeps the stream marked live; MediaMTX kills this loop on not-ready.
    runOnReady: >
      bash -c 'while true; do
        curl -s -X POST -H "x-ingest-secret: $INGEST_SHARED_SECRET"
        "https://vids.tube/api/ingest/live?path=$MTX_PATH";
        sleep 30; done'
    runOnReadyRestart: yes
    runOnNotReady: >
      curl -s -X POST -H "x-ingest-secret: $INGEST_SHARED_SECRET"
      "https://vids.tube/api/ingest/offline?path=$MTX_PATH"
```

Provide `INGEST_SHARED_SECRET` to the MediaMTX process environment (e.g. an
`Environment=INGEST_SHARED_SECRET=...` line in the systemd unit, sourced from the
Doppler value). Never commit it to the VM image.

**How auth works:** on publish, MediaMTX POSTs JSON to `/api/ingest/auth` with
`action`, `path`, and `query`. The app reads the stream key from the query string
(`?key=...`) or the RTMP password and checks it against `stream_keys`. Reads
(viewers) are allowed; only `publish` is key-checked.

## 4. nginx (TLS + bandwidth backstop)

Install nginx + certbot, get a cert:

```bash
apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d stream.vids.tube
```

Site config (`/etc/nginx/sites-available/stream.vids.tube`):

```nginx
# Cap simultaneous in-flight segment requests as the egress backstop.
limit_conn_zone $server_name zone=hlscap:10m;

server {
    listen 443 ssl;
    server_name stream.vids.tube;

    # certbot fills in ssl_certificate / ssl_certificate_key

    location / {
        limit_conn hlscap 60;     # max concurrent segment fetches
        limit_rate 1500k;          # per-response cap; bounds peak egress
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        add_header Access-Control-Allow-Origin "https://vids.tube" always;
    }
}
```

Notes:
- HLS is stateless short requests, so `limit_conn` caps *simultaneous segment
  fetches*, not viewers directly. Combined with `limit_rate`, it bounds worst-case
  egress — the cost backstop behind the app's soft 25-viewer cap.
- The app-level Realtime-presence cap (25) is the primary viewer limit; this is
  the hard ceiling that protects bandwidth if the app cap is bypassed.

Enable and reload: `ln -s` into `sites-enabled`, `nginx -t`, `systemctl reload nginx`.

## 5. OBS

- **Service:** Custom
- **Server:** `rtmp://stream.vids.tube:1935`  (or the VM IP)
- **Stream Key:** `owner?key=<STREAM_KEY>` — the channel slug plus the key from
  Studio → Go live. (MediaMTX sees path `owner` and query `key=...`; the app
  validates the key.)
- **Output:** 720p, H.264 video + AAC audio, CBR ~4500 kbps, keyframe interval 2s.

To simulcast to YouTube at the same time, add the **Multiple RTMP Output** plugin
(or Aitum) with YouTube as a second target. Mind your upload bandwidth — you pay
for both streams.

## 6. Pipeline smoke test

With nothing live, the app home/`/live` shows "No live stream right now".

1. Push a looping test file over RTMP (no OBS needed):

   ```bash
   ffmpeg -re -stream_loop -1 -i test.mp4 -c:v libx264 -c:a aac \
     -f flv "rtmp://stream.vids.tube:1935/owner?key=<STREAM_KEY>"
   ```

2. Within a few seconds the app should flip to live: the `streams` row for the
   owner channel becomes `status = live` and the home/`/live` player starts
   playing `https://stream.vids.tube/owner/index.m3u8`.
3. Open a second browser as an anonymous viewer — it should also play (free), and
   chat should show the sign-in prompt.
4. Stop FFmpeg. Within ~60s (staleness guard) or immediately (on-not-ready hook)
   the app returns to the offline card.

If go-live doesn't register, check: the `x-ingest-secret` header matches
`INGEST_SHARED_SECRET`; `/api/ingest/auth` returns 200 for the publish; nginx is
proxying `:8888`; and the stream key in OBS matches Studio → Go live.

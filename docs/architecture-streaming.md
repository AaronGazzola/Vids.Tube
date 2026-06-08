# Vids.Tube — How the video gets from you to viewers

A mid-level technical look at the two pipelines that make Vids.Tube work: **live streaming** (watch it now) and **VOD / replays** (watch it later). Auth, channels, and the rest are left out on purpose — this is the video journey, simplified, with the interesting engineering and security calls highlighted.

For the full developer reference see [architecture.md](architecture.md); for the beginner stream walkthrough see [architecture-walkthrough.md](architecture-walkthrough.md).

![Streaming & VOD architecture](streaming.png)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'18px','lineColor':'#7a7a7a'},'flowchart':{'curve':'basis','nodeSpacing':45,'rankSpacing':60}}}%%
flowchart TB

CAM["🎥 Broadcaster — OBS<br/>sends video (H.264) over RTMP"]

subgraph VM["📡 One small server (Hetzner VM)"]
  RELAY["MediaMTX — the relay<br/>catches one upload, fans it out to many viewers,<br/>and records the session to disk"]
end

CAM -->|"RTMP + secret stream key"| RELAY

subgraph LIVE["▶️ Live path — watch it happening now"]
  direction TB
  PACK["Repackage to Low-Latency HLS<br/>(remux = rewrap, do NOT re-encode)"]
  EDGE["nginx over HTTPS<br/>connection + bandwidth limits"]
  LP["Viewer's browser · hls.js player<br/>~1–3 seconds behind real time"]
  PACK --> EDGE --> LP
end

subgraph VOD["⏺️ Replay path — watch it later"]
  direction TB
  FIN["Stream ends → recording finalized<br/>repackaged to a normal MP4<br/>+ thumbnail &amp; preview frames"]
  R2["Cloudflare R2<br/>object storage"]
  CDN["Served via CDN<br/>cdn.vids.tube"]
  VP["Viewer's browser · MP4 player<br/>+ the live chat replayed in sync"]
  FIN --> R2 --> CDN --> VP
end

RELAY -->|"live"| PACK
RELAY -.->|"on stop"| FIN

%% ---------- highlighted factors ----------
N1["<b>🔒 Locked publishing</b><br/>Relay checks your secret stream key;<br/>backend hooks need a shared secret too"]
N2["<b>⚡ Remux, not re-encode</b><br/>Rewraps video with almost zero CPU,<br/>so one cheap VM serves everyone"]
N3["<b>🛡️ Capped on purpose</b><br/>~25 viewers + edge limits keep<br/>one box predictable to run"]
N4["<b>⏱️ Self-healing</b><br/>Relay heartbeats every 30s; auto-marks<br/>offline ~60s after a crash"]
N5["<b>🔒 No half-baked replays</b><br/>Video stays hidden until fully<br/>uploaded and marked 'ready'"]
N6["<b>💰 Zero egress</b><br/>R2 is cheap to store, $0 to send out —<br/>replays cost almost nothing"]

N1 -.- CAM
N2 -.- PACK
N3 -.- EDGE
N4 -.- RELAY
N5 -.- FIN
N6 -.- R2

%% ---------- styles ----------
classDef cam fill:#fff3e0,stroke:#ef6c00,color:#000,rx:12,ry:12;
classDef relay fill:#fde7ef,stroke:#c2185b,color:#000,rx:12,ry:12;
classDef live fill:#eaf3ff,stroke:#2f7ed8,color:#000,rx:12,ry:12;
classDef vod fill:#f3eaff,stroke:#7e57c2,color:#000,rx:12,ry:12;
classDef play fill:#e8f5e9,stroke:#388e3c,color:#000,rx:12,ry:12;
classDef note fill:#fffde7,stroke:#f9a825,color:#000,rx:10,ry:10;

class CAM cam;
class RELAY relay;
class PACK,EDGE live;
class FIN,R2,CDN vod;
class LP,VP play;
class N1,N2,N3,N4,N5,N6 note;
```

## The journey in plain technical terms

**Live (watch it now):**
1. **OBS → RTMP.** Your streaming software encodes the camera to H.264 video and pushes it to the server over RTMP, the standard "send a stream" protocol.
2. **MediaMTX, the relay.** One open-source server catches your single upload and is responsible for sending it out to everyone — so you upload once, not once-per-viewer.
3. **Repackage to Low-Latency HLS.** The relay *remuxes* the stream — rewraps the exact same video bytes into small HTTP chunks browsers can play. Crucially it does **not re-encode**, so CPU stays near zero.
4. **nginx edge.** A standard HTTPS server in front applies connection and bandwidth limits, then hands the chunks to viewers.
5. **hls.js in the browser** stitches the chunks back into smooth video, landing ~1–3 seconds behind real time.

**VOD (watch it later):**
1. **Stream ends.** When you stop, the relay's recording is **finalized** — repackaged into a normal MP4, and a thumbnail plus a few preview frames are generated.
2. **Cloudflare R2.** The finished file is uploaded to object storage (a "hard drive in the cloud").
3. **CDN.** It's served from `cdn.vids.tube` so viewers download it fast from a nearby edge.
4. **Playback.** The browser plays the MP4, and the chat from that stream is **replayed in sync** as you scrub.

## The interesting bits worth pointing out

- 🔒 **Publishing is locked.** Nobody can hijack your channel to broadcast — the relay verifies a secret stream key before accepting video, and the backend's recording hooks require their own shared secret.
- ⚡ **Remux, not transcode.** Rewrapping video instead of re-encoding it is the whole reason one small, cheap VM can serve the audience — re-encoding would need far more (and pricier) hardware.
- 🛡️ **Caps are a feature.** The ~25-viewer limit plus edge connection/rate limits aren't a bug — they keep a single server's cost and load predictable while the platform is small.
- ⏱️ **Self-healing.** The relay sends a heartbeat every 30 seconds; if it ever crashes mid-stream, the stream marks itself offline within ~60 seconds instead of looking "live" forever.
- 🔒 **No half-baked replays.** A recording is invisible until it's fully uploaded and flagged `ready`. The database itself won't hand out a video that's still processing — so viewers never hit a broken/partial file.
- 💰 **Zero-egress storage.** R2 charges to *store* data but nothing to *send it out*. Bandwidth is usually the scary bill for video — here, serving replays is effectively free.

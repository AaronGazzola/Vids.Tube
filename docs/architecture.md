# Vids.Tube — Architecture

A community-driven, YouTube-style live + VOD platform. This document maps the implemented v1 system: authentication, channels, the live pipeline (OBS → MediaMTX → LL-HLS), the VOD pipeline (record → R2 → playback), chat/comments/moderation, and the Supabase data model — with security, performance, and cost notes annotated inline.

The diagram is a vertical (portrait) flowchart, suitable for rendering to an image and sharing on a vertical stream. Source of record is the Mermaid block below; the rendered image lives at [architecture.png](architecture.png). To regenerate the image, extract the Mermaid block to a `.mmd` file and run `npx -y @mermaid-js/mermaid-cli -i architecture.mmd -o architecture.png -b white -s 2`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'15px','lineColor':'#888'},'flowchart':{'curve':'basis','nodeSpacing':28,'rankSpacing':36}}}%%
flowchart TB

%% ===================== CLIENTS =====================
subgraph CLIENTS["① Clients"]
  direction TB
  VIEWER["🧑 Viewer browser<br/>Next.js 15 App Router"]
end

%% ===================== AUTH =====================
subgraph AUTH["② Auth &amp; Access — no middleware"]
  direction TB
  SSR["Supabase SSR auth · browser + server clients<br/>cookies + localStorage"]
  ZUS["Zustand useAuthStore · user / isAuthenticated"]
  GUARDS["react-query guards · useRequireAuth/Owner/Channel<br/>+ OnboardingGuard"]
  SSR --> ZUS --> GUARDS
end

%% ===================== CHANNELS =====================
subgraph CHAN["③ Channels — 1 per user"]
  direction TB
  CREATE["createChannelAction · handle + slug<br/>owner_user_id = auth.uid()"]
  VIEW["channel-view /[channelSlug]<br/>header · live stage · VOD grid"]
  BRAND["branding upload → channel-assets bucket"]
  CREATE ~~~ VIEW ~~~ BRAND
end

%% ===================== LIVE PIPELINE =====================
subgraph LIVE["④ Live pipeline — remux only, no transcode"]
  direction TB
  OBS["🎥 Broadcaster — OBS (H.264 / AAC)"]
  RTMP["MediaMTX :1935 RTMP ingest (Hetzner VM)"]
  IAUTH["POST /api/ingest/auth · validate stream_keys.key (admin)"]
  ILIVE["POST /api/ingest/live · streams → live · heartbeat q30s"]
  HLS["MediaMTX :8888 LL-HLS · 7×1s segs · 200ms parts"]
  NGINX["nginx :443 TLS proxy · buffering off · conn/rate caps"]
  PLAYER["live-player.tsx · hls.js low-latency<br/>stream.vids.tube/&lt;slug&gt;/index.m3u8"]
  CAP["useViewerCap · Realtime Presence<br/>rank ≥ max_viewers(25) → full wall"]

  OBS -->|"rtmp …?key=•••"| RTMP --> IAUTH --> ILIVE --> HLS --> NGINX --> PLAYER --> CAP
end

%% ===================== VOD PIPELINE =====================
subgraph VOD["⑤ VOD pipeline — record → R2 → playback"]
  direction TB
  OFF["POST /api/ingest/offline · stream → ended<br/>create videos row (processing)"]
  FIN["mtx-finalize-vod.sh (VM) · fMP4 → faststart MP4 (-c copy)<br/>ffprobe rotation · poster + 5 previews"]
  R2["Cloudflare R2 · bucket vids-tube-vod<br/>rclone upload · zero egress"]
  REC["POST /api/ingest/recording · videos → ready<br/>paths / dims / published_at"]
  VPLAY["watch/[videoId] · VideoPlayer.tsx<br/>cdn.vids.tube/vod/&lt;slug&gt;/&lt;ts&gt;.mp4"]

  OFF --> FIN --> R2 --> REC --> VPLAY
end

%% ===================== CHAT / COMMENTS / MOD =====================
subgraph SOCIAL["⑥ Chat · Comments · Moderation"]
  direction TB
  CHAT["Live chat · Supabase Realtime<br/>useLiveChat ← chat_messages (stream_id)"]
  REPLAY["Chat replay anchored to VOD timeline<br/>chat-replay.ts offsets vs started_at (AZ-20)"]
  COMM["VOD comments + votes · fetch/invalidate<br/>author edit/delete"]
  MOD["Moderation · author self-delete only<br/>owner tools deferred to v4+"]
  CHAT --> REPLAY
  COMM ~~~ MOD
end

%% ===================== DATA MODEL =====================
subgraph DATA["⑦ Supabase Postgres — RLS on every table"]
  direction TB
  T_CH["channels · owner_user_id · slug · handle"]
  T_ST["streams · status · hls_path · max_viewers · last_seen_at"]
  T_SK["stream_keys (secret) · owner-only RLS"]
  T_CM["chat_messages · stream_id · user_id · body"]
  T_VID["videos · status · mp4/thumb/preview · w/h · published_at"]
  T_CO["comments + comment_votes · author write · public read"]

  T_CH --> T_ST --> T_SK
  T_ST --> T_CM
  T_CH --> T_VID --> T_CO
end

%% ===================== ANNOTATIONS =====================
subgraph NOTES["Cross-cutting concerns"]
  direction TB
  SEC["🔒 Security · RLS on every table; ready-only public video read ·<br/>stream_keys owner-only, server-validated · ingest hooks gated by<br/>x-ingest-secret · no middleware (query/RLS feature gating)"]
  PERF["⚡ Performance · LL-HLS ~1–3s latency, remux-only (no transcode) ·<br/>60s staleness guard auto-expires dead streams · Realtime-presence viewer cap (25)"]
  COST["💰 Cost · fixed-cost Hetzner VM, no per-viewer scaling ·<br/>edge caps limit_conn 120 / limit_rate 1500k · R2 zero egress via cdn.vids.tube"]
  SEC ~~~ PERF ~~~ COST
end

%% ===================== SPINE (subgraph-to-subgraph) =====================
VIEWER --> SSR
GUARDS --> CREATE
CREATE -->|"owner gets key · Studio"| OBS
VIEW --> PLAYER
ILIVE -.->|"publish ends"| OFF
PLAYER --> CHAT
VPLAY --> REPLAY
VPLAY --> COMM
COMM --> T_CO
T_CO --> SEC

%% ===================== STYLES =====================
classDef client fill:#e3f2fd,stroke:#1976d2,color:#0d47a1;
classDef auth fill:#ede7f6,stroke:#5e35b1,color:#311b92;
classDef chan fill:#e8f5e9,stroke:#388e3c,color:#1b5e20;
classDef live fill:#fff3e0,stroke:#ef6c00,color:#e65100;
classDef vod fill:#fce4ec,stroke:#c2185b,color:#880e4f;
classDef social fill:#e0f7fa,stroke:#0097a7,color:#006064;
classDef data fill:#f5f5f5,stroke:#616161,color:#212121;
classDef note fill:#fffde7,stroke:#f9a825,color:#5d4037;

class OBS,VIEWER client;
class SSR,ZUS,GUARDS auth;
class CREATE,VIEW,BRAND chan;
class RTMP,IAUTH,ILIVE,HLS,NGINX,PLAYER,CAP live;
class OFF,FIN,R2,REC,VPLAY vod;
class CHAT,REPLAY,COMM,MOD social;
class T_CH,T_ST,T_SK,T_CM,T_VID,T_CO data;
class SEC,PERF,COST note;
```

## How it works, in one pass

1. **Auth & access** — Supabase SSR (browser + server clients, cookie/localStorage sessions) feeds a Zustand `useAuthStore`. There is **no middleware**: route protection and feature gating are react-query hooks (`useRequireAuth`/`Owner`/`Channel`, `OnboardingGuard`) backed by Postgres RLS.
2. **Channels** — one channel per user (`owner_user_id` unique). `createChannelAction` writes `handle`/`slug` with `owner_user_id = auth.uid()`; `/[channelSlug]` renders the public channel view; branding uploads land in the `channel-assets` bucket.
3. **Live pipeline** — OBS pushes RTMP to **MediaMTX** on the Hetzner VM. `/api/ingest/auth` validates the stream key server-side; `/api/ingest/live` upserts the `streams` row to `live` and heartbeats `last_seen_at`. MediaMTX emits **LL-HLS** (7×1s segments, 200ms parts) behind an **nginx** TLS proxy (`buffering off`, connection + rate caps); the browser plays via hls.js. A Realtime-presence viewer cap (default 25) shows a "full" wall past capacity.
4. **VOD pipeline** — when publishing ends, `/api/ingest/offline` flips the stream to `ended` and creates a `videos` row (`processing`). The VM's `mtx-finalize-vod.sh` remuxes fMP4 → faststart MP4 (no transcode), probes rotation-aware dimensions, extracts a poster + 5 hover previews, and rclone-uploads to **Cloudflare R2**. `/api/ingest/recording` marks the video `ready`; viewers stream the MP4 from `cdn.vids.tube` (zero egress).
5. **Chat, comments, moderation** — live chat is **Supabase Realtime** over `chat_messages`; on VODs it replays anchored to the timeline (offsets vs `started_at`, AZ-20). VOD comments + votes are fetch/invalidate (not realtime) with author edit/delete. Moderation today is author self-delete only; owner tooling is deferred to v4+.
6. **Data model** — seven RLS-guarded tables: `channels`, `streams`, `stream_keys` (owner-only secret), `chat_messages`, `videos` (public read only when `ready`), and `comments`/`comment_votes`.

## Notes

- **Owner-run infra (not in this repo):** MediaMTX, nginx, and the rclone/R2 wiring run on the Hetzner VM per [runbooks/live-streaming-vm.md](runbooks/live-streaming-vm.md). Their hook scripts call the in-repo `/api/ingest/*` routes.
- **Not yet built:** the per-stream ticket monetization model (free delayed cast vs paid live+chat) and signed-URL segment gating — the edge connection cap currently covers the cost concern.

# Vids.Tube — How it works (a stream walkthrough)

A plain-language tour of how Vids.Tube is built, made to narrate live for people who are newer to coding. Four short chapters — click through one at a time. Each diagram has talking points underneath.

For the technical, developer-facing version, see [architecture.md](architecture.md).

---

## Chapter 1 — The big picture

![Chapter 1](walkthrough-1.png)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'20px','primaryColor':'#eaf3ff','primaryBorderColor':'#2f7ed8','lineColor':'#7a7a7a'},'flowchart':{'curve':'basis','nodeSpacing':55,'rankSpacing':70}}}%%
flowchart LR
  YOU["🎥 You<br/>the creator"]
  APP["📺 Vids.Tube<br/>the website / app"]
  VIEW["👀 Viewers<br/>people watching"]
  CLOUD["☁️ The cloud<br/>remembers everything:<br/>accounts · channels<br/>videos · chat"]

  YOU -->|"go live, upload"| APP
  APP -->|"watch & chat"| VIEW
  APP <-->|"save & load"| CLOUD

  classDef you fill:#fff3e0,stroke:#ef6c00,color:#000,rx:14,ry:14;
  classDef app fill:#eaf3ff,stroke:#2f7ed8,color:#000,rx:14,ry:14;
  classDef view fill:#e8f5e9,stroke:#388e3c,color:#000,rx:14,ry:14;
  classDef cloud fill:#f3eaff,stroke:#7e57c2,color:#000,rx:14,ry:14;
  class YOU you; class APP app; class VIEW view; class CLOUD cloud;
```

**What to say:**
- Three players: **you** (the creator), the **app** (the website everyone opens), and the **viewers**.
- Behind the app is **"the cloud"** — think of it as the app's memory. It never forgets your account, your channel, your videos, or the chat.
- Everything else we'll look at is just *details of these arrows* — how the video gets from you to viewers, and how the cloud remembers it all.

---

## Chapter 2 — Going live

![Chapter 2](walkthrough-2.png)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'20px','lineColor':'#7a7a7a'},'flowchart':{'curve':'basis','nodeSpacing':55,'rankSpacing':70}}}%%
flowchart LR
  CAM["🎥 Your camera<br/>+ OBS<br/>(streaming software)"]
  RELAY["📡 A relay server<br/>catches your video<br/>and re-sends it out<br/>to everyone"]
  V["👀 Viewers<br/>watch in their browser<br/>(up to 25 at once)"]
  CHAT["💬 Live chat<br/>happens at the same time"]

  CAM -->|"sends live video"| RELAY
  RELAY -->|"streams it out"| V
  V <-->|"type & read messages"| CHAT

  classDef cam fill:#fff3e0,stroke:#ef6c00,color:#000,rx:14,ry:14;
  classDef relay fill:#fde7ef,stroke:#c2185b,color:#000,rx:14,ry:14;
  classDef view fill:#e8f5e9,stroke:#388e3c,color:#000,rx:14,ry:14;
  classDef chat fill:#e0f7fa,stroke:#0097a7,color:#000,rx:14,ry:14;
  class CAM cam; class RELAY relay; class V view; class CHAT chat;
```

**What to say:**
- Your video doesn't go *straight* to viewers. It first hits one **relay server** — a single computer whose only job is to catch your stream and fan it back out.
- Why a relay? It means one upload from you instead of you sending video to every viewer separately.
- We **cap it at ~25 viewers** on purpose — keeps it small, friendly, and cheap to run while we're starting out.
- **Live chat runs alongside** the video — messages appear for everyone instantly.

---

## Chapter 3 — Becoming a replay

![Chapter 3](walkthrough-3.png)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'20px','lineColor':'#7a7a7a'},'flowchart':{'curve':'basis','nodeSpacing':55,'rankSpacing':70}}}%%
flowchart LR
  STOP["🛑 You stop<br/>streaming"]
  TIDY["🧹 The recording is<br/>tidied up<br/>+ a thumbnail and<br/>preview images are made"]
  STORE["☁️ Uploaded to<br/>cloud storage<br/>(cheap, holds it forever)"]
  VOD["▶️ Appears as a video<br/>anyone can watch<br/>anytime — with the<br/>chat replayed in sync"]

  STOP --> TIDY --> STORE --> VOD

  classDef stop fill:#ffebee,stroke:#e53935,color:#000,rx:14,ry:14;
  classDef tidy fill:#fde7ef,stroke:#c2185b,color:#000,rx:14,ry:14;
  classDef store fill:#f3eaff,stroke:#7e57c2,color:#000,rx:14,ry:14;
  classDef vod fill:#e8f5e9,stroke:#388e3c,color:#000,rx:14,ry:14;
  class STOP stop; class TIDY tidy; class STORE store; class VOD vod;
```

**What to say:**
- The moment you stop, the live recording gets **automatically tidied into a normal video file** — plus a thumbnail and a few preview frames for the seek bar.
- It's **uploaded to cloud storage** — a cheap "hard drive in the sky" that holds videos forever and serves them out for free.
- Then it just **shows up as a replay** on your channel. Bonus: the live chat from that stream is saved too, so it **replays in sync** as you scrub the video.
- Key idea: *live* and *replay* are two modes of the same stream — one is happening now, one is the saved copy.

---

## Chapter 4 — Accounts, channels & chat

![Chapter 4](walkthrough-4.png)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'20px','lineColor':'#7a7a7a'},'flowchart':{'curve':'basis','nodeSpacing':50,'rankSpacing':60}}}%%
flowchart TB
  IN["🔑 Sign in<br/>(email + password)"]
  CH["📄 Your channel<br/>one per person —<br/>your page with your<br/>videos & live stream"]
  LIVE["💬 Live chat<br/>during streams"]
  COM["💭 Comments & votes<br/>on replays"]
  GUARD["🛡️ No single bouncer at the door.<br/>Instead, the app asks<br/>'who are you, and are you allowed?'<br/>on every single action."]

  IN --> CH
  CH --> LIVE
  CH --> COM
  GUARD -.->|"checks every request"| CH

  classDef in fill:#fff3e0,stroke:#ef6c00,color:#000,rx:14,ry:14;
  classDef ch fill:#e8f5e9,stroke:#388e3c,color:#000,rx:14,ry:14;
  classDef social fill:#e0f7fa,stroke:#0097a7,color:#000,rx:14,ry:14;
  classDef guard fill:#fffde7,stroke:#f9a825,color:#000,rx:14,ry:14;
  class IN in; class CH ch; class LIVE,COM social; class GUARD guard;
```

**What to say:**
- You **sign in**, and you get **one channel** — your home page that holds your live stream and all your replays.
- Viewers join the **live chat** during a stream, and leave **comments** (with up/down votes) on replays afterwards.
- The security trick worth explaining: there's **no single "guard at the front door."** Instead, every time anyone clicks anything, the app re-checks *"who is this, and are they allowed to do this?"* — so even if someone pokes around, the database itself refuses anything they shouldn't see.

---

## Wrap-up (the whole story in one breath)

You go live → your video hits a **relay server** → viewers watch (and chat) in their browser → when you stop, the stream is **saved to the cloud** and becomes a **replay** → and the whole time, **the cloud remembers** your account, channel, videos, and chat, checking permissions on every step.

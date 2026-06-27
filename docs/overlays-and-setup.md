# Overlays and stream setup

**The three overlays**
- Each is a transparent web page you add to OBS as a Browser Source over your video.
- Highlights:
  - The AI picks the best chat messages and flies that person's avatar across the screen.
  - Each time someone is featured, their avatar gains one more ring.
- Goals:
  - Progress bars for likes, subscribers, and viewers, with a rainbow when a goal is hit.
  - Likes and subs count up from the moment you press Start; viewers shows the live count.
- Competition:
  - Every active chatter grows a plant. Higher engagement score means a taller plant.
  - The current leader is the tallest; everyone else scales relative to them.

**How the system is split**
- The app (deployed on Vercel):
  - Serves the overlay pages and the studio controls.
  - Holds no AI keys and does no AI work.
- The worker (runs on your own machine):
  - Does the work the app cannot: transcription, reading chat, and the AI scoring.
  - Uses your Claude subscription through `claude -p` (no API key).
  - Talks to the database with a secret key; the overlays just read what it writes.

**How the AI loop works while live**
- The order of events each cycle:
  1. The worker pulls your live audio and transcribes it locally with `whisper.cpp`.
  2. The worker reads new chat from both Vids.Tube and YouTube.
  3. About every 10 seconds it sends the recent transcript plus new chat to `claude -p`.
  4. The model returns which messages to feature and a score for each chatter.
  5. The worker saves those to the database.
  6. The overlays update: Highlights animates, Competition grows plants, the leaderboard updates.
- Chat sources:
  - Both Vids.Tube chat and YouTube chat are read.
  - Vids.Tube messages are weighted higher (worth more points).
- Goals are separate:
  - The likes/subs/viewers bars read YouTube directly from the app and do not need the worker.

**The demo page (test before going live)**
- Where: studio, "Overlay Demo" (`/studio/demo`). Only you can see it.
- What it does:
  - Plays one of your past VODs and puts the real overlays on top.
  - Lets you drag and resize the Goals and Competition overlays; Highlights travels across as it does live.
  - Lets you fake the events: feature a viewer, raise or lower a score, set goal counts and targets.
- What it proves:
  - How the overlays look, where they sit, and how they animate, over real footage.
- What it does not prove:
  - Whether the AI picks good messages or fair scores. That only happens in a real live run.

**Setup for your next stream**
- One-time setup:
  1. Put `YOUTUBE_API_KEY` in the Doppler config the app and worker use (currently it is only in `dev_personal`; see `AZ-126`).
  2. On the worker machine, install `whisper-cli` and a model, `ffmpeg`, and the `claude` CLI.
  3. Run `npm run worker:doctor` and confirm every check passes.
- Each stream, in order:
  1. Start your encoder (OBS) and simulcast to YouTube and Vids.Tube at the same time.
  2. In studio, open "Chat Overlay".
  3. Paste your YouTube video URL into the "YouTube broadcast" field and Save.
  4. Set your likes/subs/viewers targets and press Start (this snapshots the baseline).
  5. Turn featuring on.
  6. On the worker machine, run `npm run worker`.
  7. In OBS, add three Browser Sources, one per URL from the studio "OBS Browser Sources" card:
     - Highlights: `/overlay/<your-handle>`
     - Goals: `/overlay/<your-handle>/goals`
     - Competition: `/overlay/<your-handle>/competition`
  8. Position and size each source (use the demo page first to decide the layout).

**What still needs a real live test**
- The full AI loop has never run end to end against a live stream.
- First live run validates: live transcription, the `claude -p` scoring quality, and the overlays updating from real data.
- Expect to tune after the first run: the scoring rubric, the plant sizes, and the chunk timing.

**Games and future**
- The competition is the simple version: pure score-driven plants.
- Planned later (tracked in `AZ-107`): bonsai-style growth, a keystroke betting market, and a split-keyboard overlay.
- The AI shorts creator stays in its own repo for now and is not part of this stream setup.

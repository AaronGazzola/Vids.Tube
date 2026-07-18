## Why

Three owner refinements to `!me`: bios read awkwardly in the second person
when the bot is introducing someone to the room ("You've been…" → "Kuroma_
has been…"); bios only cite counts, though the chat archive stores every
message a chatter has written — enough to add a personal tidbit about what
they talk about; and the cache only refreshes on a 20-message delta, so a
regular's bio can stay identical across many streams. The owner wants a fresh
bio each stream.

## What Changes

- **Third-person phrasing**: the generation prompt names the viewer and asks
  for a third-person bio ("<name> has been part of the community since…").
- **Chat tidbits**: the prompt now includes a sample of the chatter's actual
  recent messages (up to 8 from `chat_messages` for their identity and up to
  8 from `youtube_chat_archive` by channel id, each clipped to 120 chars) and
  asks the model to weave in a playful nod to what they talk about.
- **Per-stream cache invalidation**: a cached bio regenerates when it was
  generated before the engaged stream started (fresh once per stream), in
  addition to the existing 20-message / new-video deltas which still catch
  drift within a single marathon stream.

## Capabilities

- `me-command` (modified)

## Out of scope

- Automating the YouTube chat backfill after each stream (Linear ticket;
  today `npm run backfill:youtube-chat` is rerun manually and live YouTube
  messages already land in `chat_messages`).

# stream-transcription Specification

## Purpose
TBD - created by archiving change add-local-worker-transcription. Update Purpose after archive.
## Requirements
### Requirement: Shared transcript data model

The system SHALL persist stream transcripts in a single `transcript_segments`
table keyed by `stream_id`, with each row carrying `start_s` and `end_s` (seconds
relative to the transcript origin) and `text`. The table SHALL be publicly
readable (`select using (true)`, like `chat_messages`) and **service-write only**
(no public insert/update RLS policies — only the worker's secret-key client
writes). A VOD's transcript SHALL be reachable by joining
`videos.source_stream_id` to `transcript_segments.stream_id`, so no `video_id`
column is stored on the transcript and nothing is backfilled at VOD finalization.

#### Scenario: Segments are publicly readable but not publicly writable

- **WHEN** an anonymous client reads `transcript_segments`
- **THEN** the rows are returned; AND any attempt to insert or update them without
  the secret-key service client is denied by RLS

#### Scenario: A VOD's transcript is reached via the stream link

- **WHEN** a VOD exists with `source_stream_id = S`
- **THEN** its transcript is the set of `transcript_segments` rows with
  `stream_id = S`, without any per-VOD transcript copy

### Requirement: One whisper pass per stream

The system SHALL transcribe a given live stream at most once: the worker SHALL be
the single writer of `transcript_segments`, and every later consumer (chat
scoring, shorts, VOD subtitles) SHALL read these stored segments rather than
re-transcribing. The worker SHALL resume from the latest stored segment for a
stream rather than re-transcribing from the start.

#### Scenario: Consumers reuse stored segments

- **WHEN** the transcript for a stream already exists in `transcript_segments`
- **THEN** a later consumer reads those rows instead of running whisper again

#### Scenario: Worker resumes rather than restarts

- **WHEN** the worker (re)starts while a stream already has stored segments
- **THEN** it continues appending after the latest stored `end_s` rather than
  duplicating earlier segments

### Requirement: Live transcription from the public HLS

While a stream is live and featuring is enabled for it, the worker SHALL pull the
stream's public HLS (`NEXT_PUBLIC_STREAM_HOST/owner/index.m3u8`) with `ffmpeg` in
chunks, run `whisper.cpp` (large-v3-turbo) locally, and append
`{ start_s, end_s, text }` segments to `transcript_segments` in near-real-time.
The worker SHALL determine the eligible stream from the existing live-stream query
and SHALL gate transcription on `chat_scoring_state.enabled`, holding the
`chat_scoring_state.locked_until` mutex so two worker instances do not transcribe
the same stream concurrently.

#### Scenario: Live stream is transcribed when enabled

- **WHEN** the owner's stream is live and `chat_scoring_state.enabled` is true
- **THEN** the worker appends timestamped transcript segments for that stream as
  the stream proceeds

#### Scenario: No transcription when disabled

- **WHEN** `chat_scoring_state.enabled` is false for the live stream
- **THEN** the worker does not transcribe it

#### Scenario: Only one worker transcribes a stream

- **WHEN** a second worker instance starts while another holds the
  `locked_until` mutex for the stream
- **THEN** the second instance does not also transcribe that stream

### Requirement: Stream-relative timestamps with a recoverable VOD offset

Transcript `start_s`/`end_s` SHALL be seconds relative to the transcript origin
(the first transcribed chunk, ≈ `streams.started_at`). The system SHALL preserve
enough information (the stream's `started_at` as the transcript origin) for a later
VOD consumer to compute a single offset between the transcript timeline and the
VOD playback timeline; this change SHALL NOT itself build the VOD-side mapping.

#### Scenario: Timestamps are stream-relative

- **WHEN** a segment is written N seconds after the transcript origin
- **THEN** its `start_s` is approximately N (seconds from the origin), not an
  absolute wall-clock time

#### Scenario: VOD offset is recoverable later

- **WHEN** a later consumer needs to align the transcript to a VOD's playback time
- **THEN** it can compute a single offset from the stream's `started_at` origin and
  the VOD start, without per-segment timestamp rewrites

### Requirement: Transcription runs only during live

The system SHALL run the whisper transcription job only while a stream's
`status = 'live'`. Widening worker engagement to public pre-live states
(`scheduled`/`preview`) SHALL NOT start transcription, because there is no public
audio feed before go-live.

#### Scenario: No transcription before go-live

- **WHEN** the worker engages a dated `scheduled` broadcast or its `preview`
- **THEN** no `transcript_segments` are written for it

#### Scenario: Transcription starts at go-live

- **WHEN** the engaged stream transitions to `status = 'live'`
- **THEN** the transcription job begins pulling audio and writing
  `transcript_segments`


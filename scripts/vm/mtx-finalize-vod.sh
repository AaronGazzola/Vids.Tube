#!/usr/bin/env bash
#
# mtx-finalize-vod.sh — runs on the Hetzner VM as MediaMTX's runOnNotReady
# hook. Concatenates the session recording to a single faststart MP4, captures
# its pixel dimensions, extracts a poster thumbnail and a set of hover-preview
# stills, uploads everything to R2, and notifies the app's recording hook so
# the videos row can flip processing -> ready.
#
# Dependencies (from the live-streaming-vm runbook):
#   - ffmpeg, ffprobe        (apt-get install ffmpeg)
#   - rclone with r2 remote  (apt-get install rclone; see runbook §8.2)
#   - /etc/vids-tube/r2.env  (R2_* + R2_BUCKET_VOD)
#   - INGEST_SHARED_SECRET   (inherited from the systemd unit env, runbook §3)
#
# A failure here exits non-zero and the videos row stays 'processing', so a
# broken VOD is never shown to viewers (per the vod-recording spec).
#
# Soft failures (logged, do not abort):
#   - ffprobe of width/height — finalize continues without dimensions; the
#     player falls back to a 16:9 container.
#   - Individual preview-still extraction failures — we publish whichever
#     stills did succeed.
#
set -euo pipefail

SLUG="$1"
set -a; . /etc/vids-tube/r2.env; set +a

REC_DIR="/var/lib/vids-tube/rec/${SLUG}"

# A segment's start time comes from its own filename. MediaMTX writes
# recordPath .../%Y-%m-%d_%H-%M-%S-%f, so the name carries the moment recording
# began. Nothing else does: birth time (stat %W) is unsupported on this
# filesystem and returns 0, and mtime (%Y) is the LAST write — the end of the
# recording. Reading mtime is why the trim below was always negative and always
# discarded, and why no VOD has ever started at go-live.
segment_epoch() {
  local base ts
  base="$(basename "$1")"
  ts="$(printf '%s' "$base" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}' || true)"
  [ -z "$ts" ] && return 1
  date -u -d "${ts:0:10} ${ts:11:2}:${ts:14:2}:${ts:17:2}" +%s 2>/dev/null || return 1
}

# The recorder starts writing a moment before the app records the encoder as
# connected, so a broadcast's own first segment can predate its startedAt.
# Generous enough not to discard real footage, far smaller than the gap between
# two broadcasts.
BOUNDARY_TOLERANCE=120

ALL_EPOCHS=()
ALL_PATHS=()
for F in "${REC_DIR}"/*.mp4; do
  [ -e "$F" ] || continue
  if E="$(segment_epoch "$F")"; then
    ALL_EPOCHS+=("$E")
    ALL_PATHS+=("$F")
  else
    echo "skipping ${F}: filename carries no timestamp"
  fi
done

if [ "${#ALL_PATHS[@]}" -eq 0 ]; then
  echo "no recording for ${SLUG}"
  exit 0
fi

# Sort by the parsed epoch, oldest first.
mapfile -t SORTED < <(for i in "${!ALL_PATHS[@]}"; do
  printf '%s\t%s\n' "${ALL_EPOCHS[$i]}" "${ALL_PATHS[$i]}"
done | sort -n)

NEWEST_EPOCH="$(printf '%s\n' "${SORTED[-1]}" | cut -f1)"

# Ask about the broadcast using the NEWEST segment, which always belongs to the
# session being finalized. Asking about the oldest is how debris from a
# broadcast that ended days ago used to select the wrong session.
RECORDED_AT="$(date -u -d "@${NEWEST_EPOCH}" +%Y-%m-%dT%H:%M:%SZ)"

TS="$(date +%s)"
OUT="/var/lib/vids-tube/out/${SLUG}"
mkdir -p "$OUT"
MP4="${OUT}/${TS}.mp4"
JPG="${OUT}/${TS}.jpg"
PREVIEW_DIR="${OUT}/${TS}-previews"
mkdir -p "$PREVIEW_DIR"

# Ask the app where the public (live) portion starts and whether the broadcast has
# ended. The recording captures from RTMP connect (preview onward), but the VOD
# must exclude everything before go-live. TRIM = live_at - session start of the
# FIRST segment, clamped to >= 0. A missing live_at means the broadcast never went
# live, so there is no VOD to build.
LIVE_AT=""
STARTED_AT=""
ENDED="false"
BOUNDS="$(curl -fsS -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" \
  "https://vids.tube/api/ingest/recording?path=${SLUG}&recordedAt=${RECORDED_AT}" \
  2>/dev/null || true)"
LIVE_AT="$(printf '%s' "$BOUNDS" | jq -r '.liveAt // empty' 2>/dev/null || true)"
STARTED_AT="$(printf '%s' "$BOUNDS" | jq -r '.startedAt // empty' 2>/dev/null || true)"
ENDED="$(printf '%s' "$BOUNDS" | jq -r '.ended // false' 2>/dev/null || echo false)"

if [ -z "${LIVE_AT:-}" ]; then
  echo "no live_at for ${SLUG}; broadcast never went live — no VOD"
  exit 0
fi

# Split the segments against this broadcast's own start. Everything before the
# boundary belongs to an earlier broadcast and must not be concatenated onto the
# front of this one.
STARTED_EPOCH="$(date -u -d "$STARTED_AT" +%s 2>/dev/null || echo 0)"
if [ "${STARTED_EPOCH:-0}" -le 0 ]; then
  echo "no startedAt for ${SLUG} — refusing to guess the session boundary"
  exit 1
fi
BOUNDARY=$(( STARTED_EPOCH - BOUNDARY_TOLERANCE ))

SEGMENTS=()
DEBRIS=()
for ROW in "${SORTED[@]}"; do
  E="$(printf '%s' "$ROW" | cut -f1)"
  P="$(printf '%s' "$ROW" | cut -f2-)"
  if [ "$E" -ge "$BOUNDARY" ]; then
    SEGMENTS+=("$P")
  else
    DEBRIS+=("$P")
    echo "segment from an earlier broadcast, excluded: $(basename "$P")"
  fi
done

if [ "${#SEGMENTS[@]}" -eq 0 ]; then
  echo "every segment predates ${SLUG}'s start — refusing to publish a VOD built from debris"
  exit 1
fi

FIRST_EPOCH="$(printf '%s\n' "${SORTED[@]}" | while IFS=$'\t' read -r e p; do
  if [ "$e" -ge "$BOUNDARY" ]; then echo "$e"; break; fi
done)"

TRIM=0
LIVE_EPOCH="$(date -u -d "$LIVE_AT" +%s 2>/dev/null || echo 0)"
if [ "${LIVE_EPOCH:-0}" -gt 0 ] && [ "${FIRST_EPOCH:-0}" -gt 0 ]; then
  DELTA=$(( LIVE_EPOCH - FIRST_EPOCH ))
  if [ "$DELTA" -gt 0 ]; then
    TRIM="$DELTA"
  fi
fi

# Build a concat list: the first segment trimmed to start at go-live, then every
# later reconnect segment whole. Trimming the first needs a keyframe-safe remux to
# a temp file; the rest are concatenated with -c copy.
CONCAT_DIR="${OUT}/${TS}-parts"
mkdir -p "$CONCAT_DIR"
CONCAT_LIST="${CONCAT_DIR}/list.txt"
: > "$CONCAT_LIST"

FIRST="${SEGMENTS[0]}"
FIRST_PART="${CONCAT_DIR}/part-00000.mp4"
if [ "$TRIM" -gt 0 ]; then
  echo "trimming ${TRIM}s of pre-live footage from the first segment"
  ffmpeg -y -ss "$TRIM" -i "$FIRST" -c copy -movflags +faststart "$FIRST_PART"
else
  ffmpeg -y -i "$FIRST" -c copy -movflags +faststart "$FIRST_PART"
fi
echo "file '${FIRST_PART}'" >> "$CONCAT_LIST"

for i in "${!SEGMENTS[@]}"; do
  [ "$i" -eq 0 ] && continue
  echo "file '${SEGMENTS[$i]}'" >> "$CONCAT_LIST"
done

if [ "${#SEGMENTS[@]}" -gt 1 ]; then
  echo "concatenating ${#SEGMENTS[@]} segments (${#SEGMENTS[@]} - 1 reconnect jump cuts)"
fi
ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy -movflags +faststart "$MP4"
rm -rf "$CONCAT_DIR"

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP4" | cut -d. -f1 || true)"
if [ -z "${DUR:-}" ]; then DUR=0; fi

# Capture pixel dimensions. Treat probe failure as soft so VODs still publish
# (the player derives orientation from the video's intrinsic size when these
# are null). ffprobe reports *coded* dimensions, which ignore rotation
# metadata, so we also read the rotation and swap width/height for ±90° turns
# to report the *displayed* orientation (a portrait phone capture is often a
# rotated landscape raster).
WIDTH=""
HEIGHT=""
if DIMS="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$MP4" 2>/dev/null)"; then
  if [[ "$DIMS" =~ ^([0-9]+)x([0-9]+)$ ]]; then
    WIDTH="${BASH_REMATCH[1]}"
    HEIGHT="${BASH_REMATCH[2]}"
  else
    echo "ffprobe returned unexpected dimensions: '${DIMS}' — continuing without"
  fi
else
  echo "ffprobe failed to read dimensions — continuing without"
fi

if [ -n "$WIDTH" ] && [ -n "$HEIGHT" ]; then
  ROTATION="$(ffprobe -v error -select_streams v:0 -show_entries stream_side_data=rotation -of default=nw=1:nk=1 "$MP4" 2>/dev/null | head -1)"
  if [ -z "${ROTATION:-}" ]; then
    ROTATION="$(ffprobe -v error -select_streams v:0 -show_entries stream_tags=rotate -of default=nw=1:nk=1 "$MP4" 2>/dev/null | head -1)"
  fi
  case "${ROTATION#-}" in
    90|270)
      echo "rotation ${ROTATION}° detected — swapping width/height to display orientation"
      SWAP="$WIDTH"
      WIDTH="$HEIGHT"
      HEIGHT="$SWAP"
      ;;
  esac
fi

# Poster thumbnail at min(10s, dur/2).
if [ "$DUR" -gt 0 ]; then
  if [ "$DUR" -lt 20 ]; then
    SEEK=$(( DUR / 2 ))
  else
    SEEK=10
  fi
else
  SEEK=0
fi
ffmpeg -y -ss "$SEEK" -i "$MP4" -frames:v 1 "$JPG"

# Hover-preview stills: 5 evenly-spaced JPGs scaled to ~480px wide. We sample
# at 5%, 25%, 45%, 65%, 85% so we skip the dead frames at the very start/end
# of a livestream recording.
PREVIEW_COUNT=5
PREVIEW_KEYS_JSON="[]"
PREVIEW_KEYS=()
if [ "$DUR" -gt 5 ]; then
  PERCENTS=(5 25 45 65 85)
  for i in "${!PERCENTS[@]}"; do
    PCT="${PERCENTS[$i]}"
    N=$(( i + 1 ))
    PREV_SEEK=$(( DUR * PCT / 100 ))
    PREV_FILE="${PREVIEW_DIR}/preview-${N}.jpg"
    if ffmpeg -y -ss "$PREV_SEEK" -i "$MP4" -frames:v 1 \
        -vf "scale='min(480,iw)':-2" "$PREV_FILE" >/dev/null 2>&1; then
      PREVIEW_KEYS+=("vod/${SLUG}/${TS}/preview-${N}.jpg")
    else
      echo "preview still ${N} (seek=${PREV_SEEK}s) failed — skipping"
    fi
  done
  if [ "${#PREVIEW_KEYS[@]}" -gt 0 ]; then
    PREVIEW_KEYS_JSON="$(printf '%s\n' "${PREVIEW_KEYS[@]}" | jq -R . | jq -sc .)"
  fi
fi

KEY_MP4="vod/${SLUG}/${TS}.mp4"
KEY_JPG="vod/${SLUG}/${TS}.jpg"

rclone copyto "$MP4" "r2:${R2_BUCKET_VOD}/${KEY_MP4}"
rclone copyto "$JPG" "r2:${R2_BUCKET_VOD}/${KEY_JPG}"

# Upload only the stills that actually succeeded.
if [ "${#PREVIEW_KEYS[@]}" -gt 0 ]; then
  for KEY in "${PREVIEW_KEYS[@]}"; do
    BASENAME="$(basename "$KEY")"
    rclone copyto "${PREVIEW_DIR}/${BASENAME}" "r2:${R2_BUCKET_VOD}/${KEY}"
  done
fi

# Build the payload. Omit width/height when probe failed (the hook treats
# missing fields as legacy-compatible per the recording-complete-publication-hook
# spec).
PAYLOAD="$(jq -nc \
  --arg mp4 "${KEY_MP4}" \
  --arg jpg "${KEY_JPG}" \
  --argjson dur "${DUR}" \
  --arg w "${WIDTH}" \
  --arg h "${HEIGHT}" \
  --arg recordedAt "${RECORDED_AT}" \
  --argjson previews "${PREVIEW_KEYS_JSON}" \
  '{
     mp4Path: $mp4,
     thumbnailPath: $jpg,
     durationS: $dur,
     previewPaths: $previews
   }
   + ( ($w | length) > 0 and ($h | length) > 0
       | if . then { width: ($w|tonumber), height: ($h|tonumber) } else {} end )
   + ( ($recordedAt | length) > 0
       | if . then { recordedAt: $recordedAt } else {} end )')"

curl -fsS -o /dev/null -X POST \
  -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" \
  -H "content-type: application/json" \
  -d "${PAYLOAD}" \
  "https://vids.tube/api/ingest/recording?path=${SLUG}"

rm -rf "$PREVIEW_DIR"

# Everything below runs only after the upload and the app notification have both
# succeeded, so a failure removes nothing.

# Segments from an earlier broadcast go now, whether or not that broadcast was
# ever marked ended. Waiting for "ended" is what let the 28-Jul-2026 broadcast
# leave three days of footage lying around for the next stream to absorb.
if [ "${#DEBRIS[@]}" -gt 0 ]; then
  FREED=0
  for SEG in "${DEBRIS[@]}"; do
    SZ="$(stat -c %s "$SEG" 2>/dev/null || echo 0)"
    FREED=$(( FREED + SZ ))
    rm -f "$SEG"
  done
  echo "removed ${#DEBRIS[@]} segment(s) from an earlier broadcast, freeing $(( FREED / 1048576 )) MB"
fi

# This broadcast's own segments stay until it has ended: a reconnect will add
# more footage and re-finalize, concatenating everything since go-live.
if [ "${ENDED}" = "true" ]; then
  for SEG in "${SEGMENTS[@]}"; do
    rm -f "$SEG"
  done
fi

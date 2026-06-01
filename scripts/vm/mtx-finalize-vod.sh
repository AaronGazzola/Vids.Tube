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
SRC="$(ls -t ${REC_DIR}/*.mp4 2>/dev/null | head -1 || true)"
if [ -z "${SRC:-}" ]; then
  echo "no recording for ${SLUG}"
  exit 0
fi

TS="$(date +%s)"
OUT="/var/lib/vids-tube/out/${SLUG}"
mkdir -p "$OUT"
MP4="${OUT}/${TS}.mp4"
JPG="${OUT}/${TS}.jpg"
PREVIEW_DIR="${OUT}/${TS}-previews"
mkdir -p "$PREVIEW_DIR"

ffmpeg -y -i "$SRC" -c copy -movflags +faststart "$MP4"

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP4" | cut -d. -f1 || true)"
if [ -z "${DUR:-}" ]; then DUR=0; fi

# Capture pixel dimensions. Treat probe failure as soft so VODs still publish
# (the player falls back to 16:9 when width/height are null).
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
if [ "$DUR" -gt 5 ]; then
  PERCENTS=(5 25 45 65 85)
  PREVIEW_KEYS=()
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
if [ "${#PREVIEW_KEYS[@]:-0}" -gt 0 ]; then
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
  --argjson previews "${PREVIEW_KEYS_JSON}" \
  '{
     mp4Path: $mp4,
     thumbnailPath: $jpg,
     durationS: $dur,
     previewPaths: $previews
   }
   + ( ($w | length) > 0 and ($h | length) > 0
       | if . then { width: ($w|tonumber), height: ($h|tonumber) } else {} end )')"

curl -fsS -o /dev/null -X POST \
  -H "x-ingest-secret: ${INGEST_SHARED_SECRET}" \
  -H "content-type: application/json" \
  -d "${PAYLOAD}" \
  "https://vids.tube/api/ingest/recording?path=${SLUG}"

rm -f "$SRC"
rm -rf "$PREVIEW_DIR"

#!/bin/sh
set -eu

MTX_PATH="${1:-${MTX_PATH:-owner}}"
RTMP_HOST="${LADDER_RTMP_HOST:-127.0.0.1:1935}"
SRC="${LADDER_SOURCE:-rtmp://${RTMP_HOST}/${MTX_PATH}}"
HLS_ROOT="${LADDER_HLS_ROOT:-/var/lib/vids-tube/hls}"
OUT_DIR="${HLS_ROOT}/${MTX_PATH}"
PID_FILE="${LADDER_PID_FILE:-/run/vids-tube-ladder-${MTX_PATH}.pid}"
LOG_FILE="${LADDER_LOG:-/var/log/vids-tube-ladder.log}"

GOP="${LADDER_GOP:-30}"
PRESET="${LADDER_PRESET:-veryfast}"
SEGMENT_SECONDS="${LADDER_SEGMENT_SECONDS:-1}"
LIST_SIZE="${LADDER_LIST_SIZE:-6}"

# One ffmpeg produces every rendition into one HLS output, so all three share a
# clock and their segments start at the same instants. Republishing each rung
# into MediaMTX was tried and left the rungs half a second out of phase with the
# source, which is the stutter the ladder exists to remove.
encode_once() {
  # LADDER_INPUT_FLAGS is empty in production and carries -re for the packaging
  # proof, which reads a file rather than a live publisher.
  # exec, so that backgrounding this function gives the supervisor ffmpeg's own
  # pid to signal rather than a wrapper shell's.
  # shellcheck disable=SC2086
  exec ffmpeg -hide_banner -loglevel warning -nostdin \
    -rw_timeout 5000000 ${LADDER_INPUT_FLAGS:-} -i "${SRC}" \
    -filter_complex "[0:v]split=2[v540in][v720in];[v540in]scale=540:960[v540];[v720in]scale=720:1280[v720]" \
    -map "[v540]" -map 0:a \
    -map "[v720]" -map 0:a \
    -map 0:v -map 0:a \
    -c:a copy \
    -c:v:0 libx264 -preset "${PRESET}" -profile:v:0 high -level:v:0 3.0 \
    -b:v:0 1200k -maxrate:v:0 1200k -bufsize:v:0 2400k \
    -c:v:1 libx264 -preset "${PRESET}" -profile:v:1 high -level:v:1 3.1 \
    -b:v:1 2500k -maxrate:v:1 2500k -bufsize:v:1 5000k \
    -c:v:2 copy \
    -g "${GOP}" -keyint_min "${GOP}" -sc_threshold 0 -force_key_frames source \
    -f hls -hls_time "${SEGMENT_SECONDS}" -hls_list_size "${LIST_SIZE}" \
    -hls_flags delete_segments+independent_segments+program_date_time+temp_file \
    -hls_segment_type fmp4 \
    -hls_fmp4_init_filename "init_%v.mp4" \
    -hls_segment_filename "${OUT_DIR}/seg_%v_%05d.m4s" \
    -var_stream_map "v:0,a:0,name:540 v:1,a:1,name:720 v:2,a:2,name:1080" \
    "${OUT_DIR}/stream_%v.m3u8"
}

source_is_up() {
  ffprobe -v error -rw_timeout 5000000 -i "${SRC}" -show_entries format=duration >/dev/null 2>&1
}

# Every rendition now comes out of one process, so losing that process ends
# playback rather than degrading it. Restart it while the encoder is still
# publishing, and give up once the source has gone.
if [ "${LADDER_SUPERVISOR:-0}" = "1" ]; then
  FFMPEG_PID=""
  # The supervisor records its own pid rather than letting the parent record it.
  # setsid may or may not fork depending on whether the caller already leads a
  # process group, so the parent's $! is not reliably this process — and it is
  # this process that the stop script must signal, because after setsid its pid
  # is also the process group id.
  echo $$ >"${PID_FILE}"
  # Take the running ffmpeg down with the supervisor, so stopping the ladder
  # never leaves a transcode running on a machine with no broadcast. Guarded
  # against an empty pid, which would otherwise signal the whole process group.
  trap '[ -n "${FFMPEG_PID}" ] && kill -TERM "${FFMPEG_PID}" 2>/dev/null; exit 0' TERM INT HUP
  while :; do
    encode_once &
    FFMPEG_PID=$!
    wait "${FFMPEG_PID}" || true
    if ! source_is_up; then
      echo "$(date -Is) ladder stopping for ${MTX_PATH}: source is gone"
      break
    fi
    echo "$(date -Is) ladder restarting for ${MTX_PATH}: encoder exited while the source is still publishing"
    sleep 1
  done
  exit 0
fi

if [ "${LADDER_ENABLED:-1}" != "1" ]; then
  echo "$(date -Is) ladder disabled for ${MTX_PATH}; unset LADDER_ENABLED=0 to turn it back on" >>"${LOG_FILE}"
  exit 0
fi

if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "$(date -Is) ladder already running for ${MTX_PATH}" >>"${LOG_FILE}"
  exit 0
fi

if [ ! -f "${OUT_DIR}/master.m3u8" ]; then
  echo "$(date -Is) ladder refused to start: ${OUT_DIR}/master.m3u8 is missing; write it with 'npx tsx scripts/vm/write-master-playlist.ts --path ${MTX_PATH}'" >>"${LOG_FILE}"
  exit 1
fi

if ! source_is_up; then
  echo "$(date -Is) ladder refused to start: ${SRC} is unreachable" >>"${LOG_FILE}"
  exit 1
fi

# Clear the previous broadcast's segments and variant playlists, keeping the
# per-channel master, which is written once at install time.
find "${OUT_DIR}" -maxdepth 1 -type f ! -name master.m3u8 -delete

# setsid puts the supervisor in its own process group so the stop script can
# signal the group and take the running ffmpeg with it. Where setsid is absent
# the stop script falls back to signalling the supervisor alone.
rm -f "${PID_FILE}"
if command -v setsid >/dev/null 2>&1; then
  LADDER_SUPERVISOR=1 setsid "$0" "${MTX_PATH}" >>"${LOG_FILE}" 2>&1 &
else
  LADDER_SUPERVISOR=1 "$0" "${MTX_PATH}" >>"${LOG_FILE}" 2>&1 &
fi
echo "$(date -Is) ladder starting for ${MTX_PATH}, writing ${OUT_DIR}" >>"${LOG_FILE}"

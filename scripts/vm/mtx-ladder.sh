#!/bin/sh
set -eu

MTX_PATH="${1:-${MTX_PATH:-owner}}"
RTMP_HOST="${LADDER_RTMP_HOST:-127.0.0.1:1935}"
PID_FILE="/run/vids-tube-ladder-${MTX_PATH}.pid"
LOG_FILE="/var/log/vids-tube-ladder.log"

GOP="${LADDER_GOP:-30}"
PRESET="${LADDER_PRESET:-veryfast}"

if [ "${LADDER_ENABLED:-0}" != "1" ]; then
  echo "$(date -Is) ladder disabled for ${MTX_PATH}; set LADDER_ENABLED=1 to turn it on" >>"${LOG_FILE}"
  exit 0
fi

if [ -f "${PID_FILE}" ] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
  echo "$(date -Is) ladder already running for ${MTX_PATH}" >>"${LOG_FILE}"
  exit 0
fi

SRC="rtmp://${RTMP_HOST}/${MTX_PATH}"

if ! ffprobe -v error -rw_timeout 5000000 -i "${SRC}" -show_entries format=duration >/dev/null 2>&1; then
  echo "$(date -Is) ladder refused to start: ${SRC} is unreachable" >>"${LOG_FILE}"
  exit 1
fi

ffmpeg -hide_banner -loglevel warning -nostdin \
  -i "${SRC}" \
  -filter_complex "[0:v]split=2[v720in][v540in];[v720in]scale=720:1280[v720];[v540in]scale=540:960[v540]" \
  -map "[v720]" -map 0:a? \
  -c:v libx264 -preset "${PRESET}" -profile:v high \
  -b:v 2500k -maxrate 2500k -bufsize 5000k \
  -g "${GOP}" -keyint_min "${GOP}" -sc_threshold 0 -force_key_frames source \
  -c:a copy -f flv "rtmp://${RTMP_HOST}/${MTX_PATH}_720" \
  -map "[v540]" -map 0:a? \
  -c:v libx264 -preset "${PRESET}" -profile:v high \
  -b:v 1200k -maxrate 1200k -bufsize 2400k \
  -g "${GOP}" -keyint_min "${GOP}" -sc_threshold 0 -force_key_frames source \
  -c:a copy -f flv "rtmp://${RTMP_HOST}/${MTX_PATH}_540" \
  >>"${LOG_FILE}" 2>&1 &

echo $! >"${PID_FILE}"
echo "$(date -Is) ladder started for ${MTX_PATH} as pid $(cat "${PID_FILE}")" >>"${LOG_FILE}"

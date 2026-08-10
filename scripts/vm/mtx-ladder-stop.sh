#!/bin/sh
set -eu

MTX_PATH="${1:-${MTX_PATH:-owner}}"
HLS_ROOT="${LADDER_HLS_ROOT:-/var/lib/vids-tube/hls}"
OUT_DIR="${HLS_ROOT}/${MTX_PATH}"
PID_FILE="${LADDER_PID_FILE:-/run/vids-tube-ladder-${MTX_PATH}.pid}"
LOG_FILE="${LADDER_LOG:-/var/log/vids-tube-ladder.log}"

if [ -f "${PID_FILE}" ]; then
  PID="$(cat "${PID_FILE}")"
  # The supervisor runs in its own process group, so signalling the group takes
  # the running ffmpeg with it rather than leaving it writing segments.
  if kill -0 "${PID}" 2>/dev/null; then
    kill -TERM "-${PID}" 2>/dev/null || kill -TERM "${PID}" 2>/dev/null || true
    sleep 2
    kill -KILL "-${PID}" 2>/dev/null || kill -KILL "${PID}" 2>/dev/null || true
    echo "$(date -Is) ladder stopped for ${MTX_PATH} (pid ${PID})" >>"${LOG_FILE}"
  fi
  rm -f "${PID_FILE}"
fi

# A supervisor that died without taking its ffmpeg with it would otherwise leave
# a transcode running forever on a machine with no broadcast, which on a 2 vCPU
# box is expensive. Match on the output directory, which no other process writes.
if command -v pkill >/dev/null 2>&1; then
  pkill -TERM -f "hls_segment_filename ${OUT_DIR}/" 2>/dev/null || true
fi

# Drop the broadcast's segments and variant playlists so a stale manifest does
# not outlive it. The per-channel master is kept, and resolves to nothing until
# the next broadcast starts, which is how the single-rendition address behaves
# when nothing is publishing.
if [ -d "${OUT_DIR}" ]; then
  find "${OUT_DIR}" -maxdepth 1 -type f ! -name master.m3u8 -delete
fi

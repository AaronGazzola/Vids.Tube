#!/bin/sh
set -eu

MTX_PATH="${1:-${MTX_PATH:-owner}}"
PID_FILE="/run/vids-tube-ladder-${MTX_PATH}.pid"
LOG_FILE="/var/log/vids-tube-ladder.log"

if [ ! -f "${PID_FILE}" ]; then
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if kill -0 "${PID}" 2>/dev/null; then
  kill "${PID}" 2>/dev/null || true
  sleep 2
  kill -9 "${PID}" 2>/dev/null || true
  echo "$(date -Is) ladder stopped for ${MTX_PATH} (pid ${PID})" >>"${LOG_FILE}"
fi

rm -f "${PID_FILE}"

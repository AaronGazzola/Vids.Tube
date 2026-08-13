#!/bin/sh
# Proves the packaging: runs the real transcoder against a synthetic source with
# a known keyframe cadence and checks the properties that make renditions
# interchangeable. Packaging is what failed on the first attempt, so this runs
# the transcoder rather than inspecting a hand-written manifest.
#
# Needs ffmpeg and npx. Runs anywhere either lives; MediaMTX and a browser are
# not involved. The on-stream confirmation is AZ-250.
#
# This proves packaging, not the lifecycle. Stopping the ladder relies on signals
# reaching the transcoder's process group, which works on the streaming machine
# but not under Git Bash on Windows, where a run leaves ffmpeg behind. Confirm
# the stop path on the machine, per the runbook.
#
#   sh scripts/vm/verify-ladder.sh
set -eu

HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO="$(CDPATH= cd -- "${HERE}/../.." && pwd)"
WORK="$(mktemp -d)"
CHANNEL="verify"
OUT="${WORK}/${CHANNEL}"
SOURCE="${WORK}/source.mp4"
FAILURES=0

cleanup() {
  LADDER_HLS_ROOT="${WORK}" LADDER_PID_FILE="${WORK}/pid" LADDER_LOG="${WORK}/log" \
    sh "${HERE}/mtx-ladder-stop.sh" "${CHANNEL}" >/dev/null 2>&1 || true
  rm -rf "${WORK}"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "ok: $1"
}

echo "building a 1080x1920 source at 5 Mbps with a keyframe every second"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=1080x1920:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000" \
  -t 20 -pix_fmt yuv420p \
  -c:v libx264 -preset veryfast -b:v 5000k -g 30 -keyint_min 30 -sc_threshold 0 \
  -c:a aac -ac 2 -ar 48000 -shortest "${SOURCE}"

mkdir -p "${OUT}"

# The master playlist is static per channel, and the streaming machine already
# has the real one installed. Preferring it means this runs on the machine with
# nothing but ffmpeg — no checkout, no Node — and checks the exact file
# production serves rather than a fresh copy that merely ought to match.
# Generating from the repository is the fallback, for running from a checkout.
MASTER=""
if [ -n "${LADDER_MASTER:-}" ] && [ -f "${LADDER_MASTER}" ]; then
  MASTER="${LADDER_MASTER}"
else
  for candidate in "${LADDER_HLS_INSTALL_ROOT:-/var/lib/vids-tube/hls}"/*/master.m3u8; do
    [ -f "${candidate}" ] || continue
    MASTER="${candidate}"
    break
  done
fi

if [ -n "${MASTER}" ]; then
  echo "using the installed master playlist: ${MASTER}"
  cp "${MASTER}" "${OUT}/master.m3u8"
elif [ -f "${REPO}/scripts/vm/write-master-playlist.ts" ] && command -v npx >/dev/null 2>&1; then
  echo "no installed master playlist; generating one from the repository"
  npx --yes tsx "${REPO}/scripts/vm/write-master-playlist.ts" --root "${WORK}" --path "${CHANNEL}" >/dev/null
else
  echo "FAIL: no master playlist to verify against."
  echo "  Install one at /var/lib/vids-tube/hls/<channel>/master.m3u8, or point"
  echo "  LADDER_MASTER at a copy, or run this from a checkout with npx available."
  exit 1
fi

echo "starting the transcoder, with nothing enabling it, since the ladder is on by default"
LADDER_SOURCE="${SOURCE}" \
LADDER_INPUT_FLAGS="-re -stream_loop -1" \
LADDER_HLS_ROOT="${WORK}" \
LADDER_PID_FILE="${WORK}/pid" \
LADDER_LOG="${WORK}/log" \
  sh "${HERE}/mtx-ladder.sh" "${CHANNEL}"

sleep 12

VARIANTS="stream_540.m3u8 stream_720.m3u8 stream_1080.m3u8"

for v in ${VARIANTS}; do
  [ -f "${OUT}/${v}" ] || fail "${v} was never written"
done

# 7.2 Every rendition advances. A playlist that is present but frozen fails.
for v in ${VARIANTS}; do
  before="$(grep -c '\.m4s' "${OUT}/${v}" 2>/dev/null || echo 0)"
  first="$(grep '\.m4s' "${OUT}/${v}" | tail -1 || true)"
  eval "SEEN_${v%%.*}=\"${first}\""
  [ "${before}" -gt 0 ] || fail "${v} lists no segments"
done

sleep 4

for v in ${VARIANTS}; do
  latest="$(grep '\.m4s' "${OUT}/${v}" | tail -1 || true)"
  eval "previous=\$SEEN_${v%%.*}"
  if [ "${latest}" = "${previous}" ]; then
    fail "${v} did not advance: still ending at ${latest:-nothing}"
  else
    pass "${v} advanced to ${latest}"
  fi
done

# 7.3 Segment boundaries match. This is the property republishing could not give.
boundaries() {
  grep '^#EXTINF' "$1"
}
media_sequence() {
  grep '^#EXT-X-MEDIA-SEQUENCE' "$1" | head -1
}

REF_SEQ="$(media_sequence "${OUT}/stream_1080.m3u8")"
REF_BOUNDS="$(boundaries "${OUT}/stream_1080.m3u8")"
for v in stream_540.m3u8 stream_720.m3u8; do
  if [ "$(media_sequence "${OUT}/${v}")" != "${REF_SEQ}" ]; then
    fail "${v} is at a different media sequence from the top rendition"
  elif [ "$(boundaries "${OUT}/${v}")" != "${REF_BOUNDS}" ]; then
    fail "${v} does not share the top rendition's segment boundaries"
  else
    pass "${v} shares the top rendition's segment boundaries"
  fi
done

# 7.4 Audio is the same everywhere, and the top rendition is the source's picture.
audio_shape() {
  ffprobe -v error -select_streams a:0 \
    -show_entries stream=codec_name,sample_rate,channels \
    -of csv=p=0 "$1" 2>/dev/null | head -1
}
video_shape() {
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=p=0 "$1" 2>/dev/null | head -1
}

REF_AUDIO="$(audio_shape "${SOURCE}")"
for v in ${VARIANTS}; do
  got="$(audio_shape "${OUT}/${v}")"
  if [ "${got}" != "${REF_AUDIO}" ]; then
    fail "${v} carries audio ${got:-nothing}, the source carries ${REF_AUDIO}"
  else
    pass "${v} carries the source's audio unchanged"
  fi
done

for pair in "stream_540.m3u8 540,960" "stream_720.m3u8 720,1280" "stream_1080.m3u8 1080,1920"; do
  set -- ${pair}
  got="$(video_shape "${OUT}/$1")"
  if [ "${got}" != "$2" ]; then
    fail "$1 is ${got:-nothing}, expected $2"
  else
    pass "$1 is $2"
  fi
done

# 7.5 The master advertises three renditions, lowest first, each one a playlist
# the transcoder actually wrote.
MASTER="${OUT}/master.m3u8"
COUNT="$(grep -c '^#EXT-X-STREAM-INF' "${MASTER}")"
[ "${COUNT}" -eq 3 ] || fail "the master advertises ${COUNT} renditions, expected 3"

BANDWIDTHS="$(grep '^#EXT-X-STREAM-INF' "${MASTER}" | sed 's/.*BANDWIDTH=\([0-9]*\).*/\1/')"
if [ "${BANDWIDTHS}" != "$(echo "${BANDWIDTHS}" | sort -n)" ]; then
  fail "the master does not advertise renditions lowest bandwidth first"
else
  pass "the master advertises renditions lowest bandwidth first"
fi

for name in $(grep -v '^#' "${MASTER}" | grep -v '^$'); do
  if [ -f "${OUT}/${name}" ]; then
    pass "the master's ${name} is a playlist the transcoder wrote"
  else
    fail "the master advertises ${name}, which the transcoder never wrote"
  fi
done

echo
if [ "${FAILURES}" -eq 0 ]; then
  echo "ladder packaging verified"
else
  echo "${FAILURES} check(s) failed; the transcoder log is below"
  cat "${WORK}/log" || true
  exit 1
fi

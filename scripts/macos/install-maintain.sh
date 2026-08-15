#!/usr/bin/env bash
# Turns the maintenance runner on, for good.
#
# Writes a launchd job pointing at this checkout and this user, loads it, and
# checks it took. Run it once. Nothing to edit, nothing to remember afterwards.
#
#   ./scripts/macos/install-maintain.sh
#
# Re-running is safe: the job is unloaded and rewritten, so this is also how to
# move the checkout or repair a broken install.
set -euo pipefail

LABEL="dev.vidstube.maintain"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="${HOME}/Library/Logs"
INTERVAL="${MAINTAIN_INTERVAL_SECONDS:-1800}"

if [ "$(uname)" != "Darwin" ]; then
  echo "This installs a launchd job, which is macOS only."
  echo "Elsewhere, schedule 'npm run maintain' however that system schedules things."
  exit 1
fi

echo "repo:     ${REPO}"
echo "user:     $(whoami)"
echo "interval: every ${INTERVAL}s"
echo

# Fail here rather than every 30 minutes in a log nobody reads.
echo "checking this machine can do the work..."
if ! (cd "$REPO" && npm run --silent maintain >/dev/null 2>&1); then
  echo
  echo "A sweep does not run yet. Run it directly to see what is missing:"
  echo "  cd ${REPO} && npm run maintain"
  echo
  echo "Most likely: Doppler is not authenticated for this user, or yt-dlp or"
  echo "the Claude CLI is not installed. Fix that, then run this again."
  exit 1
fi
echo "a sweep runs."
echo

mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}"

# Unload first so re-running repairs rather than duplicates.
launchctl unload "$PLIST" 2>/dev/null || true

# A login shell on purpose: launchd gives a job a bare environment, so without
# one node, npm, doppler and yt-dlp are not on the path and every sweep dies in
# the preflight.
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd '${REPO}' &amp;&amp; npm run maintain</string>
  </array>
  <key>StartInterval</key>
  <integer>${INTERVAL}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/vidstube-maintain.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/vidstube-maintain.error.log</string>
</dict>
</plist>
PLIST_EOF

launchctl load "$PLIST"

if launchctl list | grep -q "$LABEL"; then
  echo "installed and running."
  echo
  echo "It sweeps every ${INTERVAL}s and at every login, from now on."
  echo "  logs:      ${LOG_DIR}/vidstube-maintain.log"
  echo "  status:    npm run maintain:status"
  echo "  turn off:  npm run maintain:uninstall"
else
  echo "the job did not load. Check: launchctl list | grep ${LABEL}"
  exit 1
fi

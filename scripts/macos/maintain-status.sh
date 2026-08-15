#!/usr/bin/env bash
# Is the maintenance runner on, and is it doing anything?
set -uo pipefail

LABEL="dev.vidstube.maintain"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG="${HOME}/Library/Logs/vidstube-maintain.log"

if [ ! -f "$PLIST" ]; then
  echo "not installed. Run: npm run maintain:install"
  exit 1
fi

if launchctl list | grep -q "$LABEL"; then
  echo "on"
  launchctl list | grep "$LABEL" | awk '{print "  pid " $1 ", last exit " $2}'
else
  echo "installed but not loaded. Run: npm run maintain:install"
fi

echo
if [ -f "$LOG" ]; then
  echo "last 20 lines of ${LOG}:"
  tail -20 "$LOG"
else
  echo "no log yet at ${LOG}; the first sweep has not run."
fi

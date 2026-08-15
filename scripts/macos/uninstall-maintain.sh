#!/usr/bin/env bash
# Turns the maintenance runner off. Broadcasts stop being settled until it is
# turned back on, or until someone runs `npm run maintain` by hand.
set -uo pipefail

LABEL="dev.vidstube.maintain"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "off. Nothing settles a broadcast now until you run: npm run maintain:install"

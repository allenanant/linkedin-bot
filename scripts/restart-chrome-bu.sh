#!/bin/bash
# Restart the dedicated LinkedIn Chrome on the invisible Xvfb display :2.
# Called manually if the bot's Chrome dies or after a reboot.
#
# Prerequisites:
#   - Xvfb on display :2 (auto-started by the system; /tmp/.X2-lock should exist)
#   - Chrome profile at /home/allen-thomas/chrome-bu-profile (logged into LinkedIn)
#
# Result: Chrome listening on http://localhost:9222 with the LinkedIn session,
# rendered on the invisible Xvfb display, never visible on Allen's desktop.
set -u

PROFILE="$HOME/chrome-bu-profile"
PORT=9222

# Kill any existing Chrome attached to this profile (parent + renderers all die)
PIDS=$(pgrep -f "chrome --user-data-dir=$PROFILE" || true)
if [ -n "$PIDS" ]; then
  echo "Killing existing Chrome PIDs: $PIDS"
  echo "$PIDS" | xargs -r kill 2>/dev/null
  sleep 3
fi

# Make sure Xvfb is running on :2
if ! pgrep -af "Xvfb :2" >/dev/null; then
  echo "Starting Xvfb on :2..."
  nohup Xvfb :2 -screen 0 1440x900x24 >/tmp/xvfb-2.log 2>&1 &
  sleep 2
fi

# Launch Chrome on the virtual display
nohup env DISPLAY=:2 /opt/google/chrome/chrome \
  --user-data-dir="$PROFILE" \
  --remote-debugging-port=$PORT \
  --remote-allow-origins=* \
  --no-first-run \
  --no-default-browser-check \
  --start-maximized \
  --window-size=1440,900 \
  https://www.linkedin.com/feed/ >/tmp/chrome-bu.log 2>&1 &

echo "Chrome PID=$!"
sleep 6

# Sanity: CDP endpoint up?
if curl -fsS "http://localhost:$PORT/json/version" >/dev/null 2>&1; then
  echo "Chrome listening on :$PORT (DISPLAY=:2). Bot can attach."
else
  echo "ERROR: Chrome did not start CDP on :$PORT. Check /tmp/chrome-bu.log"
  exit 1
fi

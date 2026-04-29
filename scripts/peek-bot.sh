#!/bin/bash
# Peek at the bot's invisible Chrome on the Linux box.
# Run this from your Mac. Takes a fresh screenshot of whatever the bot's Chrome
# is currently showing on Xvfb :2 and opens it in Preview.
#
# Usage:
#   ./scripts/peek-bot.sh                  # current page snapshot
#   ./scripts/peek-bot.sh feed             # navigate to /feed first, then screenshot
#   ./scripts/peek-bot.sh <full-url>       # navigate to URL, then screenshot
set -eu

DEST_URL="${1:-}"
SHOT_LOCAL="/tmp/peek-bot.png"
SHOT_REMOTE="/tmp/peek-bot.png"
HOST="allen-thomas@allen-ubuntu-laptop"

# If shorthand "feed" given, expand it
case "$DEST_URL" in
  feed)  DEST_URL="https://www.linkedin.com/feed/" ;;
  invites) DEST_URL="https://www.linkedin.com/mynetwork/invitation-manager/received/" ;;
  recent) DEST_URL="https://www.linkedin.com/in/allen-anant-thomas/recent-activity/comments/" ;;
esac

REMOTE_SCRIPT=$(cat <<PYEOF
import time
url = "$DEST_URL"
if url:
    goto(url)
    wait_for_load()
    time.sleep(4)
print("URL:", page_info().get("url",""))
screenshot("$SHOT_REMOTE", full=False)
PYEOF
)

ssh "$HOST" "export PATH=\$HOME/.local/bin:\$PATH; printf '%s' '$REMOTE_SCRIPT' | BU_NAME=linkedin /home/allen-thomas/.local/bin/browser-harness 2>&1 | tail -3"

scp -q "$HOST:$SHOT_REMOTE" "$SHOT_LOCAL"
echo "Saved: $SHOT_LOCAL"
open "$SHOT_LOCAL"

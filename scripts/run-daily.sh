#!/bin/bash
# LinkedIn Bot - Daily run script (called by crontab)
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/allenanantthomas/.local/bin:$PATH"
export HOME="/Users/allenanantthomas"

cd /Users/allenanantthomas/Documents/linkedin-bot

# Log with timestamp
echo "=== $(date) ===" >> logs/daily-run.log 2>&1
/usr/local/bin/npx tsx src/index.ts run >> logs/daily-run.log 2>&1
echo "=== Finished $(date) ===" >> logs/daily-run.log 2>&1

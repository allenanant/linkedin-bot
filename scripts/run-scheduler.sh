#!/bin/bash
# LinkedIn Bot Scheduler - wrapper script for launchd
# This script sets up the environment and runs the scheduler

cd /Users/allenanantthomas/Documents/linkedin-bot

# Ensure node/npx are in PATH
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin:$PATH"

# Run the scheduler
exec /usr/local/bin/npx tsx src/index.ts schedule

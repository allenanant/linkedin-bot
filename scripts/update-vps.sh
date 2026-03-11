#!/bin/bash
set -e

# ============================================================
# LinkedIn Bot - VPS Update Script
# Run this to pull latest code and restart
# ============================================================

APP_DIR="$HOME/linkedin-bot"

echo ""
echo "============================================"
echo "  LinkedIn Bot - Updating..."
echo "============================================"
echo ""

cd "$APP_DIR"

echo ">> Pulling latest code..."
git pull

echo ""
echo ">> Installing dependencies..."
npm install

echo ""
echo ">> Building TypeScript..."
npm run build

echo ""
echo ">> Restarting processes..."
pm2 restart ecosystem.config.js

echo ""
echo ">> Current status:"
pm2 status

VPS_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "  Update complete!"
echo "  Dashboard: http://$VPS_IP:3000"
echo ""

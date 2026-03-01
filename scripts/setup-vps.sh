#!/bin/bash
set -e

# ============================================================
# LinkedIn Bot - VPS Setup Script
# Run this on a fresh Ubuntu VPS to set up everything
# ============================================================

echo ""
echo "============================================"
echo "  LinkedIn Bot - VPS Setup"
echo "============================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  echo "Please run with sudo: sudo bash setup-vps.sh"
  exit 1
fi

# Get the actual user (not root) for PM2 setup
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME=$(eval echo "~$ACTUAL_USER")
APP_DIR="$ACTUAL_HOME/linkedin-bot"

echo "Setting up for user: $ACTUAL_USER"
echo "Install directory: $APP_DIR"
echo ""

# ---- Step 1: Install Node.js 20 ----
echo ">> Step 1/7: Installing Node.js 20..."
if command -v node &>/dev/null && [[ "$(node -v)" == v20* ]]; then
  echo "   Node.js $(node -v) already installed. Skipping."
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "   Installed Node.js $(node -v)"
fi

# ---- Step 2: Install PM2 ----
echo ""
echo ">> Step 2/7: Installing PM2..."
if command -v pm2 &>/dev/null; then
  echo "   PM2 already installed. Skipping."
else
  npm install -g pm2
  echo "   PM2 installed."
fi

# ---- Step 3: Clone the repository ----
echo ""
echo ">> Step 3/7: Cloning repository..."
if [ -d "$APP_DIR" ]; then
  echo "   Directory $APP_DIR already exists."
  echo "   Pulling latest changes..."
  cd "$APP_DIR"
  sudo -u "$ACTUAL_USER" git pull
else
  cd "$ACTUAL_HOME"
  sudo -u "$ACTUAL_USER" git clone https://github.com/allenanant/linkedin-bot.git
  cd "$APP_DIR"
fi

# ---- Step 4: Install dependencies ----
echo ""
echo ">> Step 4/7: Installing npm dependencies..."
cd "$APP_DIR"
sudo -u "$ACTUAL_USER" npm install
echo "   Dependencies installed."

# ---- Step 5: Set up .env file ----
echo ""
echo ">> Step 5/7: Setting up environment variables..."
if [ -f "$APP_DIR/.env" ]; then
  echo "   .env file already exists. Skipping."
  echo "   (Delete $APP_DIR/.env and re-run if you want to re-enter values)"
else
  echo ""
  echo "   I need your .env file contents."
  echo "   Open your local project's .env file, copy ALL the contents,"
  echo "   then paste them below and press Enter, then Ctrl+D when done:"
  echo ""
  echo "   (Waiting for paste...)"
  echo ""

  ENV_CONTENT=""
  while IFS= read -r line; do
    ENV_CONTENT+="$line"$'\n'
  done

  echo "$ENV_CONTENT" > "$APP_DIR/.env"
  chown "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "   .env file created and secured."
fi

# ---- Step 6: Create logs directory ----
echo ""
echo ">> Step 6/7: Creating logs directory..."
mkdir -p "$APP_DIR/logs"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/logs"
echo "   Logs directory ready."

# ---- Step 7: Open firewall port 3000 ----
echo ""
echo ">> Step 7/7: Configuring firewall..."
if command -v ufw &>/dev/null; then
  ufw allow 3000/tcp 2>/dev/null || true
  ufw allow 22/tcp 2>/dev/null || true
  echo "   Port 3000 opened in UFW."
else
  echo "   UFW not found. Make sure port 3000 is open in your Hostinger panel."
fi

# ---- Start the application with PM2 ----
echo ""
echo "============================================"
echo "  Starting LinkedIn Bot..."
echo "============================================"
echo ""

cd "$APP_DIR"

# Stop any existing PM2 processes for this app
sudo -u "$ACTUAL_USER" pm2 delete linkedin-bot 2>/dev/null || true
sudo -u "$ACTUAL_USER" pm2 delete linkedin-dashboard 2>/dev/null || true

# Start both processes
sudo -u "$ACTUAL_USER" pm2 start ecosystem.config.js

# Set PM2 to auto-start on reboot
echo ""
echo ">> Setting up auto-start on reboot..."
pm2 startup systemd -u "$ACTUAL_USER" --hp "$ACTUAL_HOME" 2>/dev/null || true
sudo -u "$ACTUAL_USER" pm2 save

# ---- Done! ----
VPS_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Dashboard: http://$VPS_IP:3000"
echo ""
echo "  Useful commands:"
echo "    pm2 status              - Check if processes are running"
echo "    pm2 logs                - See live logs"
echo "    pm2 logs linkedin-bot   - Scheduler logs only"
echo "    pm2 logs linkedin-dashboard - Dashboard logs only"
echo "    pm2 restart all         - Restart everything"
echo ""
echo "  To update later, run:"
echo "    cd ~/linkedin-bot && sudo bash scripts/update-vps.sh"
echo ""

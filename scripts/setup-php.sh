#!/usr/bin/env bash
set -euo pipefail

echo "[Setup] Installing packages..."
sudo apt-get update
# Debian 13 (trixie) uses libgpiod3; include dnsmasq and iptables-persistent for hotspot
sudo apt-get install -y nginx php php-pgsql php-curl php-xml php-mbstring postgresql gpiod libgpiod3 dnsmasq iptables iptables-persistent

echo "[Setup] Placing Nginx site..."
sudo cp deploy/nginx-sulit-wifi.conf /etc/nginx/sites-available/sulit-wifi
sudo ln -sf /etc/nginx/sites-available/sulit-wifi /etc/nginx/sites-enabled/sulit-wifi
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo "[Setup] Enabling services..."
sudo cp deploy/systemd/sulit-php-api.service /etc/systemd/system/
sudo cp deploy/systemd/sulit-gpio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sulit-php-api --now
sudo systemctl enable sulit-gpio --now

echo "[Setup] Allow www-data to apply network settings via sudo..."
sudo cp deploy/sudoers/sulit-www-data /etc/sudoers.d/sulit-www-data
sudo chmod 0440 /etc/sudoers.d/sulit-www-data

echo "[Setup] Complete. Visit the site via your Pi's IP."
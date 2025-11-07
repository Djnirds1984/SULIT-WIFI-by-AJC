# Restore Guide (PHP Backend)

This guide helps you restore SULIT WIFI using the PHP backend on a fresh Raspberry Pi.

## Prerequisites
- Raspberry Pi OS (Debian-based)
- Internet access

## 1) Clone repository
```bash
sudo mkdir -p /opt/sulit-wifi-portal
cd /opt
sudo git clone https://github.com/Djnirds1984/SULIT-WIFI-by-AJC.git sulit-wifi-portal
cd sulit-wifi-portal
```

## 2) Install packages
```bash
sudo apt-get update
sudo apt-get install -y nginx php php-pgsql php-curl php-xml php-mbstring \
  postgresql gpiod libgpiod2
```

## 3) Configure environment
```bash
sudo cp .env.example .env
sudo nano .env
# Set PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, JWT_SECRET
# Optionally set GPIO_CHIP_INDEX
```

## 4) Initialize database
```bash
sudo -u postgres createuser -P sulituser   # choose a password
sudo -u postgres createdb sulitwifi -O sulituser

# Initialize schema via API start (first run will create tables)
```

## 5) Deploy Nginx site
```bash
sudo cp deploy/nginx-sulit-wifi.conf /etc/nginx/sites-available/sulit-wifi
sudo ln -sf /etc/nginx/sites-available/sulit-wifi /etc/nginx/sites-enabled/sulit-wifi
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 6) Start PHP API (simple option)
```bash
sudo systemctl stop php-fpm || true
sudo /usr/bin/php -S 0.0.0.0:3001 -t /opt/sulit-wifi-portal/public /opt/sulit-wifi-portal/php-backend/router.php
```

## 7) Start GPIO daemon
```bash
sudo /usr/bin/php /opt/sulit-wifi-portal/php-backend/bin/gpio_daemon.php
```

## Optional: Systemd services
```bash
sudo cp deploy/systemd/sulit-php-api.service /etc/systemd/system/
sudo cp deploy/systemd/sulit-gpio.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sulit-php-api --now
sudo systemctl enable sulit-gpio --now
```

## Optional: Restore DB from backup
Use `scripts/restore-db.sh` with your `.env` configured.

## Verify
```bash
curl http://localhost:3001/api/settings/public
curl -X POST http://localhost:3001/api/admin/login -H "Content-Type: application/json" -d '{"password":"admin"}'
```

## Notes
- For production, prefer PHP-FPM (see Nginx config Option B).
- Ensure coin GPIO pin and polarity are set in Admin → System.
- If `gpiomon` exits repeatedly, the daemon falls back to `gpioget` polling.
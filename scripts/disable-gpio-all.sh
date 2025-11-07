#!/usr/bin/env bash
set -euo pipefail

echo "[GPIO] Disabling common GPIO consumers (I2C, SPI, 1-Wire, pigpio, serial console)"

if [[ $EUID -ne 0 ]]; then
  echo "[GPIO] Please run as root (sudo)" >&2
  exit 1
fi

CFG="/boot/config.txt"
BACKUP="/boot/config.txt.bak.$(date +%Y%m%d-%H%M%S)"
cp "$CFG" "$BACKUP"
echo "[GPIO] Backed up config to $BACKUP"

# Disable I2C and SPI dtparams
sed -i -E 's/^(\s*)dtparam=i2c_arm=on/\1# dtparam=i2c_arm=on # disabled by disable-gpio-all.sh/g' "$CFG"
sed -i -E 's/^(\s*)dtparam=i2c=on/\1# dtparam=i2c=on # disabled by disable-gpio-all.sh/g' "$CFG"
sed -i -E 's/^(\s*)dtparam=spi=on/\1# dtparam=spi=on # disabled by disable-gpio-all.sh/g' "$CFG"

# Disable 1-Wire overlay if present
sed -i -E 's/^(\s*)dtoverlay=w1-gpio.*/\1# dtoverlay=w1-gpio # disabled by disable-gpio-all.sh/g' "$CFG"

# Comment any dtoverlay that explicitly binds GPIOs (best-effort)
sed -i -E 's/^(\s*)dtoverlay=(.*)/\1# dtoverlay=\2 # disabled by disable-gpio-all.sh/g' "$CFG"

echo "[GPIO] Commented I2C/SPI/1-Wire dtparams and dtoverlays in $CFG"

echo "[GPIO] Stopping and disabling pigpio daemon if installed"
if command -v systemctl >/dev/null 2>&1; then
  systemctl stop pigpiod || true
  systemctl disable pigpiod || true
fi

echo "[GPIO] Disabling serial console on UART if enabled"
CMDLINE="/boot/cmdline.txt"
cp "$CMDLINE" "$CMDLINE.bak.$(date +%Y%m%d-%H%M%S)"
sed -i -E 's/console=serial0,[0-9]+ //g' "$CMDLINE" || true
sed -i -E 's/console=ttyAMA0,[0-9]+ //g' "$CMDLINE" || true

echo "[GPIO] Attempting to unexport any sysfs GPIOs"
for path in /sys/class/gpio/gpio*; do
  if [[ -d "$path" ]]; then
    num=$(basename "$path" | sed 's/gpio//')
    echo "$num" > /sys/class/gpio/unexport 2>/dev/null || true
  fi
done

echo "[GPIO] Killing processes holding /dev/gpiomem or /dev/gpiochip*"
if command -v fuser >/dev/null 2>&1; then
  fuser -k /dev/gpiomem || true
  for chip in /dev/gpiochip*; do
    [[ -e "$chip" ]] && fuser -k "$chip" || true
  done
fi

echo "[GPIO] Cleanup complete. Please reboot to apply config changes: sudo reboot"
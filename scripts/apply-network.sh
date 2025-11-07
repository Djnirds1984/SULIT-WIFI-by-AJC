#!/usr/bin/env bash
set -euo pipefail

# Log to file and console
LOG_FILE="/var/log/sulit-apply-network.log"
mkdir -p /var/log || true
touch "$LOG_FILE" || true
echo "===== $(date '+%Y-%m-%d %H:%M:%S') Apply Network Start =====" >> "$LOG_FILE"
exec > >(tee -a "$LOG_FILE") 2>&1

# SULIT WIFI: Apply hotspot network settings
# This script configures the hotspot interface IP, DHCP (dnsmasq), and NAT.
# It autodetects whether NetworkManager (nmcli) is available; otherwise, it
# falls back to dhcpcd for static IP configuration.

if [[ ${EUID} -ne 0 ]]; then
  echo "[ERROR] This script must be run as root." >&2
  exit 1
fi

SSID="SULIT WIFI Hotspot"
SECURITY="open"           # 'open' or 'wpa2'
PASSWORD=""
IFACE="wlan0"
IPADDR="10.0.0.1"
DHCP_START="10.0.0.10"
DHCP_END="10.0.0.254"
LEASE="12h"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssid) SSID="$2"; shift 2;;
    --security) SECURITY="$2"; shift 2;;
    --password) PASSWORD="$2"; shift 2;;
    --iface) IFACE="$2"; shift 2;;
    --ip) IPADDR="$2"; shift 2;;
    --dhcp-start) DHCP_START="$2"; shift 2;;
    --dhcp-end) DHCP_END="$2"; shift 2;;
    --lease) LEASE="$2"; shift 2;;
    *) echo "[WARN] Unknown arg: $1"; shift;;
  esac
done

log() {
  echo "[ApplyNetwork] $*"
  if command -v logger >/dev/null 2>&1; then
    logger -t sulit-apply "[ApplyNetwork] $*"
  fi
}

prefix() { # return /24 prefix from IP like 10.0.0.1 -> 10.0.0
  IFS='.' read -r a b c _ <<<"$1"; echo "$a.$b.$c"; 
}

CIDR="$IPADDR/24"
NET_PREFIX="$(prefix "$IPADDR")"

log "Ensuring required packages..."
export DEBIAN_FRONTEND=noninteractive
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y || true
  # dnsmasq for DHCP, iptables-persistent to save NAT rules (optional)
  apt-get install -y dnsmasq iptables iptables-persistent || true
fi

WAN_IF="$(ip route | awk '/default/ {print $5; exit}')"
if [[ -z "$WAN_IF" ]]; then
  log "[WARN] Could not detect WAN interface; NAT may fail."
fi

if command -v nmcli >/dev/null 2>&1; then
  log "Configuring via NetworkManager on $IFACE with SSID '$SSID'..."
  # Create or update AP connection
  if ! nmcli -t -f NAME connection show | grep -Fxq "sulit-ap"; then
    nmcli connection add type wifi ifname "$IFACE" con-name sulit-ap ssid "$SSID"
  fi

  nmcli connection modify sulit-ap 802-11-wireless.mode ap 802-11-wireless.band bg
  if [[ "$SECURITY" == "open" ]]; then
    nmcli connection modify sulit-ap wifi-sec.key-mgmt none
    nmcli connection modify sulit-ap +ipv4.addresses "$CIDR" ipv4.method manual
  else
    nmcli connection modify sulit-ap wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASSWORD"
    nmcli connection modify sulit-ap +ipv4.addresses "$CIDR" ipv4.method manual
  fi
  nmcli connection up sulit-ap || nmcli connection up sulit-ap
else
  log "NetworkManager not found; falling back to dhcpcd for static IP."
  DHCPCD_CONF="/etc/dhcpcd.conf"
  TMP_CONF="$(mktemp)"
  if [[ -f "$DHCPCD_CONF" ]]; then
    # Remove previous SULIT block
    awk 'BEGIN{skip=0} /# SULIT WIFI BEGIN/{skip=1} !skip{print} /# SULIT WIFI END/{skip=0}' "$DHCPCD_CONF" > "$TMP_CONF"
    mv "$TMP_CONF" "$DHCPCD_CONF"
  fi
  cat >> "$DHCPCD_CONF" <<EOF
# SULIT WIFI BEGIN
interface $IFACE
static ip_address=$CIDR
nohook wpa_supplicant
# SULIT WIFI END
EOF
  systemctl restart dhcpcd || true
fi

log "Writing dnsmasq config for DHCP..."
mkdir -p /etc/dnsmasq.d
cat > /etc/dnsmasq.d/sulit.conf <<EOF
interface=$IFACE
bind-interfaces
dhcp-range=$DHCP_START,$DHCP_END,$LEASE
dhcp-option=option:router,$IPADDR
log-queries
log-dhcp
EOF
systemctl restart dnsmasq || true

log "Enabling IP forwarding and NAT..."
sysctl -w net.ipv4.ip_forward=1 >/dev/null || true
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-sulit.conf || true

if [[ -n "$WAN_IF" ]]; then
  # Remove previous SULIT rule if present; add fresh one
  iptables -t nat -D POSTROUTING -o "$WAN_IF" -j MASQUERADE 2>/dev/null || true
  iptables -t nat -A POSTROUTING -o "$WAN_IF" -j MASQUERADE
  if command -v iptables-save >/dev/null 2>&1; then
    iptables-save > /etc/iptables/rules.v4 || true
  fi
else
  log "[WARN] Skipping NAT rule; WAN interface unknown."
fi

log "Applied: IFACE=$IFACE SSID='$SSID' IP=$IPADDR DHCP=$DHCP_START..$DHCP_END lease=$LEASE security=$SECURITY"
exit 0
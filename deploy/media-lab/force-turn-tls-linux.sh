#!/usr/bin/env bash
set -euo pipefail

windows_ip="${1:-}"
output_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Plenum/representative-media-lab"
environment_file="$output_dir/media-lab.env"

valid_ipv4() {
  local ip="$1" part
  [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  IFS=. read -r -a parts <<< "$ip"
  for part in "${parts[@]}"; do ((10#$part <= 255)) || return 1; done
}

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this script as your normal user; it will request sudo when needed." >&2
  exit 1
fi
[[ -f "$environment_file" ]] || { echo "The media lab environment file is missing." >&2; exit 1; }
host_ip="$(sed -n 's/^PLENUM_LAB_BIND_IP=//p' "$environment_file")"
if [[ -z "$windows_ip" ]]; then
  windows_ip="$(sed -n 's/^PLENUM_LAB_WINDOWS_IP=//p' "$environment_file")"
fi
if ! valid_ipv4 "$host_ip" || ! valid_ipv4 "$windows_ip" || [[ "$host_ip" == "$windows_ip" ]]; then
  echo "Usage: $0 WINDOWS_IPV4" >&2
  exit 1
fi
for command in iptables sudo; do
  command -v "$command" >/dev/null || { echo "$command is required." >&2; exit 1; }
done

sudo iptables -N PLENUM_PS545 2>/dev/null || sudo iptables -F PLENUM_PS545
sudo iptables -C DOCKER-USER -j PLENUM_PS545 2>/dev/null || sudo iptables -I DOCKER-USER 1 -j PLENUM_PS545
# DOCKER-USER runs after destination NAT, so match the original host destination.
sudo iptables -A PLENUM_PS545 -s "$windows_ip" -p tcp -m conntrack --ctorigdst "$host_ip" --ctorigdstport 443 -j ACCEPT
sudo iptables -A PLENUM_PS545 -s "$windows_ip" -p tcp -m conntrack --ctorigdst "$host_ip" --ctorigdstport 8443 -j ACCEPT
sudo iptables -A PLENUM_PS545 -s "$windows_ip" -p tcp --dport 7881 -j REJECT --reject-with tcp-reset
# shortcut: this dedicated two-laptop lab blocks all Windows UDP forwarded to Docker; use a separate lab VLAN before hosting other UDP services.
sudo iptables -A PLENUM_PS545 -s "$windows_ip" -p udp -j REJECT
sudo iptables -A PLENUM_PS545 -j RETURN

echo "Windows direct ICE and TURN/UDP are blocked; TURN/TLS 443 and HTTPS 8443 remain allowed."

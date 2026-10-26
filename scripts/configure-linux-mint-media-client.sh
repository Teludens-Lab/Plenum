#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
host_ip="${2:-}"
ca_file="${3:-}"
hosts_start="# PLENUM-PS545-MEDIA-LAB START"
hosts_end="# PLENUM-PS545-MEDIA-LAB END"
ca_target="/usr/local/share/ca-certificates/plenum-representative-media-lab.crt"
nft_table="plenum_ps545_media_lab"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

remove_hosts_block() {
  local temporary
  temporary="$(mktemp)"
  awk -v start="$hosts_start" -v end="$hosts_end" '
    $0 == start { skipping=1; next }
    $0 == end { skipping=0; next }
    !skipping { print }
  ' /etc/hosts > "$temporary"
  install -m 0644 "$temporary" /etc/hosts
  rm -f "$temporary"
}

remove_configuration() {
  nft delete table inet "$nft_table" 2>/dev/null || true
  remove_hosts_block
  rm -f "$ca_target"
  update-ca-certificates >/dev/null
  echo "Removed the Plenum media-lab CA, hosts entry, and temporary firewall table."
}

case "$mode" in
  install)
    if [[ ! "$host_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
      echo "Usage: sudo $0 install WINDOWS_IPV4 /path/to/lab-ca.crt" >&2
      exit 1
    fi
    if [[ ! -f "$ca_file" ]]; then
      echo "CA certificate not found: $ca_file" >&2
      exit 1
    fi
    if ! command -v nft >/dev/null; then
      echo "nft is required on Linux Mint." >&2
      exit 1
    fi
    remove_configuration
    install -m 0644 "$ca_file" "$ca_target"
    update-ca-certificates >/dev/null
    {
      echo "$hosts_start"
      echo "$host_ip media.plenum.lan"
      echo "$hosts_end"
    } >> /etc/hosts
    nft add table inet "$nft_table"
    nft "add chain inet $nft_table output { type filter hook output priority -10; policy accept; }"
    nft add rule inet "$nft_table" output ip daddr "$host_ip" tcp dport 7881 reject with tcp reset
    nft add rule inet "$nft_table" output ip daddr "$host_ip" udp dport 50000-50100 reject
    nft add rule inet "$nft_table" output ip daddr "$host_ip" udp dport 5349 reject
    echo "Configured Linux Mint to trust the lab CA and force LiveKit through TURN/TLS on TCP 5349."
    echo "These nftables rules are temporary and disappear after reboot; use '$0 remove' for immediate cleanup."
    ;;
  remove)
    remove_configuration
    ;;
  *)
    echo "Usage: sudo $0 install WINDOWS_IPV4 /path/to/lab-ca.crt | sudo $0 remove" >&2
    exit 1
    ;;
esac

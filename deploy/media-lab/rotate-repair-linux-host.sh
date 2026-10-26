#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Plenum/representative-media-lab"
operator_file="$output_dir/operator.env"
environment_file="$output_dir/media-lab.env"
config_file="$output_dir/livekit.yaml"
ca_cert="$output_dir/secrets/lab-ca.crt"
tls_cert="$output_dir/secrets/media-tls.crt"
tls_key="$output_dir/secrets/media-tls.key"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this script as your normal user; it will request sudo when needed." >&2
  exit 1
fi
for file in "$environment_file" "$ca_cert" "$tls_cert" "$tls_key"; do
  [[ -f "$file" ]] || { echo "Required lab file is missing: $file" >&2; exit 1; }
done

host_ip="$(sed -n 's/^PLENUM_LAB_BIND_IP=//p' "$environment_file")"
if [[ ! "$host_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "The saved lab address is invalid." >&2
  exit 1
fi

api_key="plenum-$(openssl rand -hex 8)"
api_secret="$(openssl rand -hex 32)"
umask 077
cat > "$config_file" <<EOF
port: 7880
bind_addresses:
  - 0.0.0.0
rtc:
  node_ip: $host_ip
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: false
turn:
  enabled: true
  domain: media.plenum.lan
  tls_port: 443
  allow_restricted_peer_cidrs:
    - $host_ip/32
  per_user_relay_allocation_limit: 32
  cert_file: /run/secrets/media-tls-cert
  key_file: /run/secrets/media-tls-key
keys:
  $api_key: $api_secret
logging:
  level: info
EOF
cat > "$operator_file" <<EOF
LIVEKIT_URL=https://media.plenum.lan:8443
LIVEKIT_API_KEY=$api_key
LIVEKIT_API_SECRET=$api_secret
EOF
chmod 0600 "$config_file" "$operator_file"
unset api_key api_secret

sudo chown 101:101 "$tls_cert" "$tls_key"
sudo chmod 0400 "$tls_cert" "$tls_key"
sudo docker compose --env-file "$environment_file" -f "$script_dir/compose.yaml" down
sudo docker compose --env-file "$environment_file" -f "$script_dir/compose.yaml" up -d

for _ in {1..30}; do
  if [[ "$(sudo docker inspect --format '{{.State.Status}} {{.State.Restarting}}' plenum-media-lab-media-1 2>/dev/null)" == "running false" ]] && \
      curl --noproxy "*" --fail --silent --connect-timeout 2 --max-time 3 --cacert "$ca_cert" https://media.plenum.lan:8443 >/dev/null; then
    echo "LiveKit repaired and healthy. The exposed credential was rotated."
    echo "Copy the new operator file to Windows: $operator_file"
    exit 0
  fi
  sleep 1
done

sudo docker compose --env-file "$environment_file" -f "$script_dir/compose.yaml" logs --tail=20 media
echo "LiveKit did not become healthy after repair and rotation." >&2
exit 1

#!/usr/bin/env bash
set -euo pipefail

host_ip="${1:-}"
windows_ip="${2:-}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Plenum/representative-media-lab"

valid_ipv4() {
  local ip="$1" part
  [[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  IFS=. read -r -a parts <<< "$ip"
  for part in "${parts[@]}"; do ((10#$part <= 255)) || return 1; done
}

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this script as your normal user; it will request sudo only when needed." >&2
  exit 1
fi
if ! valid_ipv4 "$host_ip" || ! valid_ipv4 "$windows_ip" || [[ "$host_ip" == "$windows_ip" ]]; then
  echo "Usage: $0 LINUX_IPV4 WINDOWS_IPV4" >&2
  exit 1
fi
for command in docker openssl curl iptables sudo; do
  command -v "$command" >/dev/null || { echo "$command is required." >&2; exit 1; }
done
if [[ -e "$output_dir" ]]; then
  echo "Output directory already exists: $output_dir" >&2
  exit 1
fi

umask 077
mkdir -p "$output_dir/secrets"
ca_key="$output_dir/secrets/lab-ca.key"
ca_cert="$output_dir/secrets/lab-ca.crt"
tls_key="$output_dir/secrets/media-tls.key"
tls_csr="$output_dir/secrets/media-tls.csr"
tls_cert="$output_dir/secrets/media-tls.crt"
tls_ext="$output_dir/secrets/media-tls.ext"

openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 30 \
  -subj "/CN=Plenum Representative Lab Root CA" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -keyout "$ca_key" -out "$ca_cert"
openssl req -newkey rsa:3072 -nodes -sha256 \
  -subj "/CN=media.plenum.lan" \
  -addext "subjectAltName=DNS:media.plenum.lan" \
  -keyout "$tls_key" -out "$tls_csr"
cat > "$tls_ext" <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:media.plenum.lan
EOF
openssl x509 -req -in "$tls_csr" -CA "$ca_cert" -CAkey "$ca_key" -CAcreateserial \
  -days 30 -sha256 -extfile "$tls_ext" -out "$tls_cert"
rm -f "$ca_key" "$tls_csr" "$tls_ext" "$output_dir/secrets/lab-ca.srl"
# Compose bind-mounts file-backed secrets with host ownership on Linux.
sudo chown 101:101 "$tls_cert" "$tls_key"
sudo chmod 0400 "$tls_cert" "$tls_key"

api_key="plenum-$(openssl rand -hex 8)"
api_secret="$(openssl rand -hex 32)"
cat > "$output_dir/livekit.yaml" <<EOF
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
cat > "$output_dir/media-lab.env" <<EOF
PLENUM_LAB_BIND_IP=$host_ip
PLENUM_LAB_WINDOWS_IP=$windows_ip
PLENUM_LAB_LIVEKIT_CONFIG_FILE=$output_dir/livekit.yaml
PLENUM_LAB_TLS_CERT_FILE=$tls_cert
PLENUM_LAB_TLS_KEY_FILE=$tls_key
EOF
cat > "$output_dir/operator.env" <<EOF
LIVEKIT_URL=https://media.plenum.lan:8443
LIVEKIT_API_KEY=$api_key
LIVEKIT_API_SECRET=$api_secret
EOF

sudo install -m 0644 "$ca_cert" /usr/local/share/ca-certificates/plenum-representative-media-lab.crt
sudo update-ca-certificates >/dev/null
hosts_tmp="$(mktemp)"
awk '
  $0 == "# PLENUM-PS545-MEDIA-LAB START" { skipping=1; next }
  $0 == "# PLENUM-PS545-MEDIA-LAB END" { skipping=0; next }
  !skipping { print }
' /etc/hosts > "$hosts_tmp"
{
  cat "$hosts_tmp"
  printf '%s\n' '# PLENUM-PS545-MEDIA-LAB START' "$host_ip media.plenum.lan" '# PLENUM-PS545-MEDIA-LAB END'
} > "$hosts_tmp.updated"
sudo install -m 0644 "$hosts_tmp.updated" /etc/hosts
rm -f "$hosts_tmp" "$hosts_tmp.updated"

sudo docker compose --env-file "$output_dir/media-lab.env" -f "$script_dir/compose.yaml" config --quiet
sudo docker compose --env-file "$output_dir/media-lab.env" -f "$script_dir/compose.yaml" up -d
bash "$script_dir/force-turn-tls-linux.sh" "$windows_ip"

response=""
for _ in {1..20}; do
  if response="$(curl --noproxy "*" --fail --silent --connect-timeout 2 --max-time 3 \
    --resolve "media.plenum.lan:8443:$host_ip" --cacert "$ca_cert" https://media.plenum.lan:8443 2>/dev/null)" && \
    [[ "$response" == "OK" ]]; then
    break
  fi
  sleep 1
done
[[ "$response" == "OK" ]] || { echo "Unexpected HTTPS response: $response" >&2; exit 1; }

echo "Representative media lab is running at https://media.plenum.lan:8443 ($host_ip)."
echo "Copy only this public CA to Windows: $ca_cert"
echo "Keep livekit.yaml and operator.env on Linux."

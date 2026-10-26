[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$HostIp,
  [string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA "Plenum\representative-media-lab"),
  [switch]$TrustCertificate,
  [switch]$Start
)

$ErrorActionPreference = "Stop"
$parsedIp = $null
if (-not [Net.IPAddress]::TryParse($HostIp, [ref]$parsedIp) -or
    $parsedIp.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
    [Net.IPAddress]::IsLoopback($parsedIp)) {
  throw "HostIp must be the Windows laptop's non-loopback IPv4 address"
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$target = [IO.Path]::GetFullPath($OutputDirectory)
if ($target.StartsWith($repositoryRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputDirectory must be outside the repository"
}
if (Test-Path -LiteralPath $target) {
  throw "OutputDirectory already exists. Remove it deliberately or choose a new path: $target"
}

$opensslCandidates = @(
  "C:\Program Files\Git\usr\bin\openssl.exe",
  "C:\Program Files\Git\mingw64\bin\openssl.exe"
)
$openssl = $opensslCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $openssl) {
  throw "OpenSSL was not found. Install Git for Windows or provide OpenSSL before running this setup."
}

$secrets = Join-Path $target "secrets"
New-Item -ItemType Directory -Path $secrets -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $target /inheritance:r /grant:r "${identity}:(OI)(CI)F" "SYSTEM:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to restrict the lab secret directory ACL" }

function New-HexSecret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

$caKey = Join-Path $secrets "lab-ca.key"
$caCertificate = Join-Path $secrets "lab-ca.crt"
$tlsKey = Join-Path $secrets "media-tls.key"
$tlsRequest = Join-Path $secrets "media-tls.csr"
$tlsCertificate = Join-Path $secrets "media-tls.crt"
$certificateExtensions = Join-Path $secrets "media-tls.ext"

& $openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 30 `
  -subj "/CN=Plenum Representative Lab Root CA" `
  -addext "basicConstraints=critical,CA:TRUE" `
  -addext "keyUsage=critical,keyCertSign,cRLSign" `
  -keyout $caKey -out $caCertificate
if ($LASTEXITCODE -ne 0) { throw "Failed to create the lab CA" }

& $openssl req -newkey rsa:3072 -nodes -sha256 `
  -subj "/CN=media.plenum.lan" `
  -addext "subjectAltName=DNS:media.plenum.lan" `
  -keyout $tlsKey -out $tlsRequest
if ($LASTEXITCODE -ne 0) { throw "Failed to create the media TLS request" }

@"
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:media.plenum.lan
"@ | Set-Content -LiteralPath $certificateExtensions -Encoding ascii

& $openssl x509 -req -in $tlsRequest -CA $caCertificate -CAkey $caKey -CAcreateserial `
  -days 30 -sha256 -extfile $certificateExtensions -out $tlsCertificate
if ($LASTEXITCODE -ne 0) { throw "Failed to sign the media TLS certificate" }
Remove-Item -LiteralPath $caKey, $tlsRequest, $certificateExtensions, (Join-Path $secrets "lab-ca.srl") -Force -ErrorAction SilentlyContinue

$apiKey = "plenum-$(New-HexSecret 8)"
$apiSecret = New-HexSecret 32
$liveKitConfig = Join-Path $target "livekit.yaml"
@"
port: 7880
bind_addresses:
  - 0.0.0.0
rtc:
  node_ip: $HostIp
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: false
turn:
  enabled: true
  domain: media.plenum.lan
  tls_port: 443
  allow_restricted_peer_cidrs:
    - $HostIp/32
  per_user_relay_allocation_limit: 32
  cert_file: /run/secrets/media-tls-cert
  key_file: /run/secrets/media-tls-key
keys:
  ${apiKey}: ${apiSecret}
logging:
  level: info
"@ | Set-Content -LiteralPath $liveKitConfig -Encoding ascii

$asComposePath = { param([string]$Path) ([IO.Path]::GetFullPath($Path)).Replace("\", "/") }
$environmentFile = Join-Path $target "media-lab.env"
@"
PLENUM_LAB_BIND_IP=$HostIp
PLENUM_LAB_LIVEKIT_CONFIG_FILE=$(& $asComposePath $liveKitConfig)
PLENUM_LAB_TLS_CERT_FILE=$(& $asComposePath $tlsCertificate)
PLENUM_LAB_TLS_KEY_FILE=$(& $asComposePath $tlsKey)
"@ | Set-Content -LiteralPath $environmentFile -Encoding ascii

$operatorEnvironment = Join-Path $target "operator.env"
@"
LIVEKIT_URL=https://media.plenum.lan:8443
LIVEKIT_API_KEY=$apiKey
LIVEKIT_API_SECRET=$apiSecret
"@ | Set-Content -LiteralPath $operatorEnvironment -Encoding ascii

if ($TrustCertificate) {
  Import-Certificate -FilePath $caCertificate -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
}

$composeFile = Join-Path $repositoryRoot "deploy\media-lab\compose.yaml"
& docker compose --env-file $environmentFile -f $composeFile config --quiet
if ($LASTEXITCODE -ne 0) { throw "The representative media lab Compose configuration is invalid" }
if ($Start) {
  & docker compose --env-file $environmentFile -f $composeFile up -d
  if ($LASTEXITCODE -ne 0) { throw "The representative media lab did not start" }
}

Write-Output "Representative media lab material created at $target"
Write-Output "Public CA to copy to Linux Mint: $caCertificate"
Write-Output "Windows hosts entry: $HostIp media.plenum.lan"
Write-Output "Compose env file: $environmentFile"
Write-Output "Operator credentials file (keep on Windows): $operatorEnvironment"

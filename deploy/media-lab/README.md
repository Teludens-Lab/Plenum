# PS-545 representative media lab

This lab supports either laptop as the self-hosted LiveKit server. The verified PS-545 layout uses Linux Mint as the server and Windows Chromium as the restricted client; direct ICE/UDP, ICE/TCP, and TURN/UDP are blocked so media must use TURN/TLS. Oracle Cloud and Cloudflare are not used.

If Windows policy ignores local firewall rules, use Linux Mint as the host instead. Copy this directory to Linux and run as the normal Linux user:

```bash
chmod +x setup-linux-host.sh
./setup-linux-host.sh 10.183.94.79 10.183.94.61
```

The Linux-host path serves HTTPS signaling on TCP 8443 and embedded TURN/TLS on TCP 443. It rejects direct Windows ICE/TCP, ICE/UDP, and TURN/UDP so the named Windows client is forced through TURN/TLS. The generated credentials remain under `~/.local/share/Plenum/representative-media-lab`. The bounded per-participant TURN allocation limit is 32 so the approved reconnect exercise does not exhaust LiveKit's default limit of 12 before stale allocations expire.

For an existing Linux-host lab, reapply the Docker-aware network rule with the Windows address:

```bash
bash force-turn-tls-linux.sh 10.183.94.61
```

## 1. Find the Windows LAN address

Run `ipconfig` and select the active Wi-Fi or Ethernet IPv4 address. Do not use `127.0.0.1`, a Docker/WSL adapter, VPN adapter, or a public address.

## 2. Create and start the lab

From an elevated PowerShell in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-representative-media-lab.ps1 `
  -HostIp 192.168.1.25 -TrustCertificate -Start
```

Replace the example address. The script creates 30-day lab certificates and random LiveKit credentials under `%LOCALAPPDATA%\Plenum\representative-media-lab`, outside the repository. It restricts that directory to the current Windows identity and SYSTEM. The private keys and `operator.env` must remain on Windows.

Add this entry to the Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`) if it is not already present:

```text
192.168.1.25 media.plenum.lan
```

Allow inbound TCP 443, 7881, and 8443 plus UDP 50000-50100 only on the private LAN firewall profile. Do not expose these ports through the internet router.

## 3. Configure Linux Mint

Copy only `lab-ca.crt` and `scripts/configure-linux-mint-media-client.sh` to the Linux laptop. Then run:

```bash
chmod +x configure-linux-mint-media-client.sh
sudo ./configure-linux-mint-media-client.sh install 192.168.1.25 ./lab-ca.crt
curl --fail --cacert ./lab-ca.crt https://media.plenum.lan:8443
```

An HTTP 404 from the last command is acceptable; a certificate, DNS, connection, or TLS error is not. If the browser does not use the operating-system trust store, import `lab-ca.crt` into that browser as a trusted certificate authority. Never copy `media-tls.key`, `livekit.yaml`, or `operator.env` to the client.

## 4. Cleanup

On Linux Mint:

```bash
sudo ./configure-linux-mint-media-client.sh remove
```

On Windows, stop the lab using the `media-lab.env` path printed by setup:

```powershell
docker compose --env-file "$env:LOCALAPPDATA\Plenum\representative-media-lab\media-lab.env" `
  -f deploy/media-lab/compose.yaml down
```

Remove the `media.plenum.lan` hosts entry and the lab CA from the Current User trusted-root store after testing. The generated directory contains disposable credentials; delete it only after the evidence artifacts no longer need reproduction.

## Claim boundary

This topology proved a TURN/TLS-forced Windows Chromium path to Linux Mint on the user-authorized representative LAN on 2026-10-25. Join p95, speech-start median, Floor p95, packet loss, and controlled LiveKit restart recovery passed their approved limits. The separate PS-545 30/60-minute application soak and three final report sets also pass on the named lower-capacity equivalent. This lab still does not prove a production institution's DNS, PKI, firewall, hardware capacity, or operator procedures.

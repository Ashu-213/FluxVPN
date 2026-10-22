# FLUX VPN — Baseline Test Results & Benchmark Report

**Document Status:** Formal Baseline Benchmark (Phase 0 Technical Validation)  
**Execution Date:** October 22, 2026  
**Environment:** Local Docker WireGuard Test Server & Native Windows Client  
**Project Root:** `E:\VPN`  
**Sources of Truth:**
- [`docs/00_README.md`](file:///e:/VPN/docs/00_README.md)
- [`docs/01_REQUIREMENTS.md`](file:///e:/VPN/docs/01_REQUIREMENTS.md)
- [`docs/06_IMPLEMENTATION_PLAN.md`](file:///e:/VPN/docs/06_IMPLEMENTATION_PLAN.md)
- [`docs/ROADMAP_RECONCILIATION.md`](file:///e:/VPN/docs/ROADMAP_RECONCILIATION.md)

---

## 1. Scope & Test Environment

> [!IMPORTANT]
> **LOCAL DOCKER BENCHMARK NOTICE:**  
> The measurements documented herein were collected across a local loopback WireGuard tunnel between a Windows 11 host and a containerized Alpine Linux WireGuard server running in Docker Desktop.  
> **These results do NOT represent public internet VPN performance, external WAN transit latency, ISP throttling, or international routing.** They establish the local cryptographic and virtual interface baseline required by Phase 0 before cloud provisioning in Phase 1.

### Configuration Summary (Zero Secrets Exposed)

| Parameter | Windows Client (`flux`) | Docker Server (`flux-wireguard-test`) |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Desktop (x86_64) | Alpine Linux (Containerized) |
| **Tunnel Driver** | WireGuard for Windows (Native SCM Service) | Linux kernel / `wireguard-go` module |
| **Tunnel Interface** | `flux` (`WireGuardTunnel$flux`) | `wg0` |
| **Tunnel IPv4** | `10.13.13.2/32` | `10.13.13.1/24` |
| **Tunnel IPv6** | None (Unconfigured in split tunnel) | None (Unconfigured in split tunnel) |
| **Endpoint** | `127.0.0.1:51820` (UDP) | `0.0.0.0:51820` (Mapped Host Port) |
| **AllowedIPs Scope** | `10.13.13.0/24` (Strict Split Tunnel) | `10.13.13.2/32` |
| **Public Key** | `LdAUvKmBc4JfJwcIj12E2IHF/Ax1aHLxDG6zl0s3MA4=` | `LBW3vxr79fQW94H+xYmvI1BCQsPBUkZuJhqlR9KlS1U=` |
| **Private Keys & PSK**| Scrubbed; restricted via Windows ACLs | Stored in Docker volume; excluded from Git |

---

## 2. Cryptographic Handshake & Data Plane Verification

Cryptographic handshake and bidirectional transfer verification were inspected via both native WireGuard UAPI pipe interrogation and the container's `wg show` command:

```text
# Command: docker exec flux-wireguard-test wg show
interface: wg0
  public key: LBW3vxr79fQW94H+xYmvI1BCQsPBUkZuJhqlR9KlS1U=
  listening port: 51820

peer: LdAUvKmBc4JfJwcIj12E2IHF/Ax1aHLxDG6zl0s3MA4=
  endpoint: 172.18.0.1:57879
  allowed ips: 10.13.13.2/32
  latest handshake: 50 seconds ago
  transfer: 13.08 KiB received, 12.70 KiB sent
```

### Verification Highlights:
- **Handshake Age:** Refreshed continuously ($< 60\text{ seconds}$ during testing), well below the 180-second `HANDSHAKE_FRESHNESS_LIMIT_SECONDS` threshold.
- **Transfer Progression:** Counters progressed from $1.20\text{ KiB RX} / 1.02\text{ KiB TX}$ baseline up to $13.08\text{ KiB RX} / 12.70\text{ KiB TX}$, confirming bidirectional encapsulation and decapsulation through the tunnel interface.

---

## 3. Latency & Round-Trip Time (RTT) Baseline

Measurements were taken using the Windows ICMP client targeted at the tunnel gateway `10.13.13.1`.

### Sample 1: Standard Payload (32 Bytes, 10 Samples)
- **Command:** `ping -n 10 10.13.13.1`
- **Payload Size:** 32 bytes (60 bytes on wire including IP/ICMP headers)

| Sample # | Response Target | Payload Size | RTT (ms) | TTL | Result |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `10.13.13.1` | 32 B | 16 ms | 64 | Success (Initial route cache / wake) |
| 2 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 3 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 4 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 5 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 6 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 7 | `10.13.13.1` | 32 B | 3 ms | 64 | Success |
| 8 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 9 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |
| 10 | `10.13.13.1` | 32 B | 1 ms | 64 | Success |

**Summary Statistics:**
- **Packets Sent:** 10
- **Packets Received:** 10
- **Packet Loss:** **0.0% (0 packets lost)**
- **Minimum RTT:** $1\text{ ms}$
- **Maximum RTT:** $16\text{ ms}$ (Initial session packet)
- **Average RTT:** $2\text{ ms}$ (Steady-state: $\sim 1\text{ ms}$)

---

### Sample 2: High Payload Stress (1,000 Bytes, 10 Samples)
- **Command:** `ping -n 10 -l 1000 10.13.13.1`
- **Payload Size:** 1,000 bytes (testing larger MTU packet encapsulation)

| Sample # | Response Target | Payload Size | RTT (ms) | TTL | Result |
| :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `10.13.13.1` | 1000 B | 2 ms | 64 | Success |
| 2 | `10.13.13.1` | 1000 B | 2 ms | 64 | Success |
| 3 | `10.13.13.1` | 1000 B | 2 ms | 64 | Success |
| 4 | `10.13.13.1` | 1000 B | 2 ms | 64 | Success |
| 5 | `10.13.13.1` | 1000 B | 3 ms | 64 | Success |
| 6 | `10.13.13.1` | 1000 B | 3 ms | 64 | Success |
| 7 | `10.13.13.1` | 1000 B | 1 ms | 64 | Success |
| 8 | `10.13.13.1` | 1000 B | 1 ms | 64 | Success |
| 9 | `10.13.13.1` | 1000 B | 2 ms | 64 | Success |
| 10 | `10.13.13.1` | 1000 B | 2 ms | 64 | Success |

**Summary Statistics:**
- **Packets Sent:** 10
- **Packets Received:** 10
- **Packet Loss:** **0.0% (0 packets lost)**
- **Minimum RTT:** $1\text{ ms}$
- **Maximum RTT:** $3\text{ ms}$
- **Average RTT:** $2\text{ ms}$

---

## 4. Throughput Testing Status

- **Status:** **NOT MEASURED (Tooling Prerequisite Required)**
- **Findings:**
  - Audited host environment (`where.exe iperf3` / `where.exe iperf`): Neither tool is present in the Windows PATH.
  - Audited container environment (`docker exec flux-wireguard-test which iperf3`): Binary not installed in the lightweight Alpine image.
- **Anti-Fabrication Enforcement:** In compliance with core project ethics, no synthetic or uncollected throughput numbers are recorded.
- **Prerequisite Setup Plan for Phase 1 Throughput Verification:**
  1. **Client Setup:** Install official `iperf3` on Windows (`winget install iperf3` or standalone binary).
  2. **Server Setup:** Run an ephemeral `iperf3` listener bound to `10.13.13.1` (`docker exec flux-wireguard-test apk add --no-cache iperf3 && iperf3 -s -B 10.13.13.1`).
  3. **Benchmark Execution:** Run 10-second multi-stream TCP and UDP throughput passes:
     - `iperf3.exe -c 10.13.13.1 -P 4 -t 10` (TCP multi-stream bandwidth)
     - `iperf3.exe -c 10.13.13.1 -u -b 100M -t 10` (UDP jitter and packet loss under load)

---

## 5. DNS, IPv6, and Routing Leak Analysis

Inspection of the host routing table and network configuration established the following safety boundaries:

```text
# Command: Get-NetRoute -DestinationPrefix '10.13.13.*'
DestinationPrefix InterfaceAlias NextHop RouteMetric
----------------- -------------- ------- -----------
10.13.13.255/32   flux           0.0.0.0         256
10.13.13.2/32     flux           0.0.0.0         256
10.13.13.0/24     flux           0.0.0.0           0

# Command: Get-NetRoute -DestinationPrefix '0.0.0.0/0'
DestinationPrefix InterfaceAlias NextHop      RouteMetric
----------------- -------------- -------      -----------
0.0.0.0/0         Wi-Fi          172.25.160.1           0
```

### Leak Test Matrix

| Leak Test Category | Status in Current Setup | Rationale & Evidence |
| :--- | :---: | :--- |
| **Split-Tunnel Route Isolation** | **VERIFIED PASS** | Routing table demonstrates that only `10.13.13.0/24` is bound to the `flux` interface. All external traffic continues using `Wi-Fi` adapter `172.25.160.1`. No unintentional route injection. |
| **DNS Query Leakage** | **NOT TESTED / NOT APPLICABLE** | Split tunnel intentionally does not redirect `0.0.0.0/0` or bind custom DNS resolvers to avoid disrupting host connectivity during Phase 0. Standard DNS queries continue using local ISP/Wi-Fi resolvers. |
| **IPv6 Leakage** | **NOT TESTED / DEFERRED** | IPv6 is not configured on either peer in this local test environment (`AllowedIPs` has no IPv6 range). Any IPv6 traffic bypasses the tunnel. Full IPv6 blocking/null-routing will be implemented and tested in Phase 1. |
| **Full Tunnel Traffic Routing** | **NOT TESTED** | `AllowedIPs = 0.0.0.0/0` is not yet active on the local test client. Full internet gateway routing requires Phase 1 external node deployment with `iptables` NAT forwarding. |
| **Kill-Switch Enforcement** | **NOT TESTED** | Kill-switch firewall filtering (`WFP` on Windows / `pf` on macOS) is deferred until full tunnel routing is stabilized. |

---

## 6. Known Limitations

1. **Local Loopback Artifacts:** Pinging a Docker container over loopback yields low single-digit RTTs ($\sim 1\text{–}2\text{ ms}$). Real-world internet VPN latency will be dominated by physical distance, ISP routing hops, and external network jitter ($20\text{–}80\text{ ms}$).
2. **Container Port Mapping:** UDP datagrams transit Docker's userland proxy or bridge network (`172.18.0.1`), adding minor host-internal context-switch overhead that will not exist on bare-metal or standalone VPS deployments.
3. **No External Route Forwarding:** Container does not currently have `sysctl -w net.ipv4.ip_forward=1` enabled for outbound WAN routing. Testing full web browsing through the tunnel requires Phase 1 infrastructure.

---

## 7. Next Roadmap Milestone

With local data-plane verification, UAPI telemetry parsing, and latency baseline formally documented in accordance with Phase 0 acceptance criteria:

**Phase 1: Single Hardened Server Deployment (No Custom UI Needed)**
- Provision one Ubuntu 24.04 VPS on cloud infrastructure.
- Configure UFW firewall (default-deny incoming, allow only UDP 51820 and SSH on restricted port/key).
- Configure IPv4 forwarding and `iptables` NAT `MASQUERADE`.
- Deploy Unbound local recursive DNS resolver listening on `10.13.13.1`.
- Execute full-tunnel (`AllowedIPs = 0.0.0.0/0, ::/0`) leak tests and WAN throughput benchmarks.

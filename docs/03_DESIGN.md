# 03 — System Design

## 1. Component responsibilities

| Component | Technology | Responsibility |
|---|---|---|
| Desktop UI | React + TypeScript + Tailwind | Screens, status, settings, error display |
| Desktop shell | Tauri 2 | Packaging and desktop integration |
| Local coordinator | Rust | Validated commands, state management, OS bridge |
| Windows tunnel adapter | Trusted WireGuard Windows integration | Start/stop/status and Windows permissions |
| macOS tunnel adapter | Network Extension / `NEPacketTunnelProvider` | Packet-tunnel lifecycle and macOS entitlements |
| VPN protocol | WireGuard | Encrypted tunnel |
| VPN node | Ubuntu + WireGuard | Terminate tunnel, route allowed traffic |
| API (optional) | Node.js + Express + TypeScript | Auth, device authorization, server metadata |
| Database (optional) | PostgreSQL | Users/devices/nodes/entitlements |
| Build pipeline | GitHub Actions | Tests, build artifacts, release checks |

## 2. Tunnel lifecycle
Use an explicit state machine:
- `disconnected`
- `preparing`
- `connecting`
- `connected`
- `reconnecting`
- `disconnecting`
- `error`

Only the native tunnel adapter is authoritative for tunnel state. The UI must not set `connected` merely because a start command was issued.

All commands should be validated and narrowly scoped. Do not expose arbitrary shell execution from the UI or API.

## 3. Desktop Dashboard Layout & Component Architecture
The FLUX desktop UI employs a cinematic, monochromatic layout built upon the Obsidian & Gold design system (`#000000` canvas with `#FFC000` primary CTA):

1. **Header Navigation:**
   - Displays official FLUX brand glyph and uppercase wordmark.
   - Houses technical mode indicator (`SIMULATED` / `MOCK ENGINE`).
   - Restrained `DIAGNOSTICS` trigger button.
2. **Status Stage:**
   - Authoritative uppercase status headline (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, etc.).
   - Geometric square status indicator and uppercase microcopy subtitle.
3. **Primary Action Area:**
   - Prominent, sharp rectangular Connect CTA button in solid Gold (`#FFC000`) with black text.
   - Disconnect state rendered as an angular Dark Iron (`#181818`) container with hover alert.
4. **Relay Endpoint Selector:**
   - Sharp rectangular surface card displaying country code block, relay city, and real-time latency ping.
   - Expandable dropdown for server selection (Frankfurt, Mumbai, Singapore).
5. **Live Telemetry Strip:**
   - Active when in `connected` state.
   - 3-column monospace grid displaying Session Duration, Download rate, and Upload rate.
6. **Sanitized Diagnostics Modal:**
   - Overlay presenting technical environment parameters, active relay, and zero exposed credentials.
   - One-click sanitized report clipboard copy.
7. **Developer State Drawer:**
   - Discreet, collapsible bottom drawer providing instant state transitions for rapid UI validation.

## 4. Configuration and credentials
- Generate device keys locally when supported by the chosen integration.
- Keep private keys on the device and protect local storage using operating-system facilities.
- Send only the public key and minimum device metadata to the control plane when needed.
- Deliver configuration over HTTPS after authorization.
- Never log private keys, access tokens, OTPs, or complete VPN configuration.
- Provide a revocation procedure and document how it affects existing tunnels.

## 5. Optional API (only if accounts/devices are required)

Proposed endpoints:
- `POST /api/v1/auth/login` — authenticate using the chosen provider.
- `POST /api/v1/devices/register` — register a public key/device.
- `GET /api/v1/devices` — list the authenticated user's devices.
- `DELETE /api/v1/devices/:id` — revoke a device.
- `GET /api/v1/servers` — return available server metadata.
- `POST /api/v1/vpn/provision` — authorize and return minimum client configuration.
- `GET /api/v1/health` — service health.

These are proposed routes, not implemented APIs. Enforce user/device ownership and authorization on every request. Do not expose privileged server commands through client-facing endpoints.

## 6. Server configuration principles
- Use a unique peer identity per device.
- Assign addresses without overlap and manage them centrally.
- Apply least-privilege firewall rules.
- Configure forwarding, NAT, DNS, MTU, and IPv6 based on tested requirements.
- Keep management access separate from user traffic.
- Back up only what is needed, encrypt backups, and test restoration.
- Document peer removal and key rotation.

## 7. Optional subscription entitlement model
If the product becomes paid, define one shared entitlement rule used by provisioning and revocation. Explicitly test active, expired, cancelled-at-period-end, failed renewal, refund, suspended account, and revoked device states. Payment webhook processing must verify signatures and be idempotent.

## 8. Errors
Return user-safe errors with a request ID. Keep detailed diagnostics in protected logs without secrets or browsing history. Example codes:
- `AUTH_REQUIRED`
- `DEVICE_REVOKED`
- `SERVER_UNAVAILABLE`
- `TUNNEL_PERMISSION_DENIED`
- `TUNNEL_START_FAILED`
- `DNS_CONFIGURATION_FAILED`
- `CONFIGURATION_INVALID`

# FLUX — Windows & macOS VPN Client

**Status:** Revised product/build specification  
**Platforms:** Windows 10/11 and macOS  
**Initial deployment:** One Linux VPN server, limited test users  
**Product name:** FLUX

## Product goal
Build a simple desktop application that lets an authorized user establish an encrypted VPN connection through a server operated by FLUX. The first release prioritizes reliable connection management, clear status, privacy, and safe failure behavior.

A VPN does not guarantee that every website will be reachable. Network owners may restrict VPN use, and their acceptable-use policies and applicable law still apply. Do not market the product as guaranteed to defeat every restriction or as providing anonymity.

## 1. Decisions for this version

| Area | Decision | Reason |
|---|---|---|
| Desktop UI | React + TypeScript + Tailwind CSS | Shared UI for both desktop platforms |
| Desktop shell | Tauri 2 | Packages the UI for Windows and macOS |
| Local/native coordination | Rust | Type-safe bridge to platform-specific VPN integration |
| Initial VPN protocol | WireGuard | Mature, documented implementation; no custom cryptography |
| Windows tunnel | Integrate a trusted WireGuard Windows implementation | Avoid writing a tunnel driver/protocol |
| macOS tunnel | Network Extension / `NEPacketTunnelProvider`, subject to entitlements and signing | Uses Apple's supported VPN extension model |
| Backend | Node.js + TypeScript + Express | Reuses the team's existing JavaScript skills |
| Database | PostgreSQL | Accounts, device records, server metadata, subscriptions if needed |
| VPN server | Ubuntu Linux + WireGuard | First data-plane endpoint |
| Initial deployment | One VPS; add a second only after measured need | Reduce cost and operational complexity |
| CI | GitHub Actions | Automated linting, tests, and builds |
| Monitoring | Provider metrics and basic health checks first | Avoid premature observability complexity |

**Important:** Tauri does not itself create a VPN. The Windows and macOS tunnel integrations are separate engineering work. Validate them early.

## 2. Build order
1. Review network-use policy and obtain authorization where required.
2. Prove the tunnel with official WireGuard clients on Windows and macOS.
3. Test routes, DNS, IPv4/IPv6, reconnection, speed, and server reachability.
4. Implement the desktop UI using mocked connection state.
5. Implement the backend only when device/account management is needed.
6. Integrate native tunnel lifecycle and permissions on each OS.
7. Add security hardening, signing, documentation, and a limited pilot.
8. Consider subscriptions only after feasibility, compliance, provider terms, and operating costs are verified.

## 3. MVP scope
- Connect and disconnect.
- Clear connection state and actionable errors.
- Server endpoint/health information.
- Optional account/device registration if access needs to be restricted.
- Secure provisioning and device revocation if accounts are introduced.
- Deliberate DNS and IPv4/IPv6 routing.
- Recovery from network changes, sleep/wake, and server outages.
- Signed installers and a safe update process.
- Privacy notice and support contact.

Not in the first milestone: multiple regions, payment processing, complex analytics, split tunneling, custom protocol development, or claims of guaranteed access to blocked sites.

## 4. Repository document index
- `01_REQUIREMENTS.md` — product and technical requirements.
- `02_ARCHITECTURE.md` — components and flows.
- `03_DESIGN.md` — responsibilities, API, credential and tunnel lifecycle.
- `04_UI_THEME.md` — desktop UI design.
- `05_FOLDER_STRUCTURE.md` — proposed monorepo.
- `06_IMPLEMENTATION_PLAN.md` — phases and acceptance gates.
- `07_DATABASE_SCHEMA.md` — optional minimal schema.
- `08_SECURITY_COMPLIANCE.md` — security, privacy, operational and legal checklist.

## 5. Official references
- WireGuard: https://www.wireguard.com/
- WireGuard Quick Start: https://www.wireguard.com/quickstart/
- WireGuard for Windows: https://github.com/WireGuard/wireguard-windows
- Tauri: https://tauri.app/
- Tauri distribution: https://v2.tauri.app/distribute/
- Apple Network Extension: https://developer.apple.com/documentation/networkextension
- Node.js: https://nodejs.org/
- Express: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/

This document is a technical plan, not a completed implementation or legal advice. Verify current platform requirements and provider policies before deployment.

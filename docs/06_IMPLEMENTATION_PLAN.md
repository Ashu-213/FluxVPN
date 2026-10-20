# 06 — Implementation Plan

Estimates are planning aids, not deadlines. Do not advance until the current phase's acceptance criteria pass.

## Phase 0 — Scope and network validation
**Goal:** confirm the product is permitted and technically feasible.
- Review the university network-use policy and obtain authorization where required.
- Choose the supported Windows/macOS versions.
- Set up a test Ubuntu VPS and configure WireGuard using official documentation.
- Connect using official WireGuard clients on Windows and macOS.
- Test server reachability, routes, DNS, IPv4/IPv6, throughput, latency, network switching, and disconnect behavior.
- Record results in `docs/test-results.md`.
- Compare performance on a permitted test network and a normal control network.

**Acceptance:** a written result, documented limitations, measured baseline, and decision to proceed or stop. Do not assume the tunnel can access every blocked site.

## Phase 1 — One server, no custom UI
- Harden one Ubuntu VPS.
- Configure WireGuard, forwarding, firewall, DNS, and IPv6 behavior.
- Use official clients to prove connectivity.
- Test peer addition/removal and server restart recovery.
- Record cost and data-transfer limits.

**Acceptance:** repeatable Windows and macOS connections; routing and leak tests pass for the declared configuration; safe failure behavior is understood.

## Phase 2 — Desktop UI shell
- Create React + TypeScript + Tailwind UI.
- Package with Tauri 2.
- Implement state machine and mocked tunnel adapter.
- Add accessible status, settings, diagnostics, and error handling.

**Acceptance:** UI works on both OSes with mocked states; no misleading connection status.

## Phase 3 — Native tunnel integration
- Windows: integrate a trusted WireGuard Windows implementation using its supported service/IPC mechanism; avoid writing a driver.
- macOS: investigate and implement the required Network Extension packet-tunnel integration, signing, and entitlements.
- Keep adapters isolated behind a small interface.
- Implement start/stop/status and recovery from sleep/wake/network changes.
- Test on clean machines and restricted-permission scenarios.

**Acceptance:** repeated connect/disconnect, network switching, restart, failure, and uninstall tests pass on both platforms.

## Phase 4 — Optional control plane
Only if account/device authorization is needed:
- Add Node.js + Express + TypeScript API.
- Add PostgreSQL migrations and authentication.
- Register device public keys and provision minimal configuration.
- Implement device revocation and audit events.
- Keep privileged server management out of the public API.

**Acceptance:** unauthorized devices cannot obtain configuration; revocation behavior is measured and documented; secrets never appear in logs.

## Phase 5 — Product readiness
- Sign installers and protect update delivery.
- Publish privacy/support information and third-party notices.
- Add monitoring, backups, restore drill, and incident-response notes.
- Run dependency and security reviews.
- Pilot with a small, authorized group and gather performance data.

**Acceptance:** no unresolved critical security issues; recovery and uninstall are tested; user-facing claims match measured behavior.

## Phase 6 — Optional paid service
Only after legal and operational review:
- Confirm payment provider acceptance in writing.
- Define pricing, taxes, refunds, cancellation, renewal, and entitlement semantics.
- Add verified, idempotent webhooks and receipts.
- Re-check the cost model using real bandwidth measurements.

## Weekly review
- Bugs and crash reports.
- Connection success rate and p95 connection time.
- Node health, bandwidth, latency, and provider costs.
- Dependency/security updates.
- User support and abuse reports, if applicable.

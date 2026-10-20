# 01 — Requirements

## Functional requirements

### Desktop application
- FR-1: Install and run on supported Windows 10/11 and macOS versions.
- FR-2: Show disconnected, connecting, connected, disconnecting, and error states.
- FR-3: Connect and disconnect through a native tunnel integration.
- FR-4: Show the selected server and last connection error.
- FR-5: Recover safely from Wi-Fi changes, sleep/wake, and server interruption.
- FR-6: Do not report “Connected” until tunnel status is verified.
- FR-7: Provide clear permission/install errors and troubleshooting guidance.
- FR-8: Support app quit/uninstall without leaving undocumented network state.
- FR-9: If a kill switch is offered, it must be implemented with platform-appropriate controls and pass failure tests before being exposed.

### Server and networking
- FR-10: Establish an encrypted WireGuard tunnel to an Ubuntu server.
- FR-11: Configure IP forwarding, firewall, outbound routing/NAT, and DNS deliberately.
- FR-12: Explicitly handle IPv4 and IPv6; no accidental bypass route.
- FR-13: Support server health checks and a documented restart/recovery process.
- FR-14: Keep server administration separate from client-facing functionality.
- FR-15: Test throughput, latency, packet loss, reconnect behavior, and concurrent users.

### Accounts/devices — only if access needs to be restricted
- FR-16: Authenticate users using a vetted identity/authentication flow.
- FR-17: Register devices and allow a device to be revoked.
- FR-18: Provision only the configuration needed for an authorized device.
- FR-19: Never send a device's private key to the backend when the client can generate and retain it locally.
- FR-20: Enforce authorization at the server, not only in the UI.

### Billing — optional, not MVP
- FR-21: Do not integrate payments until provider acceptance, legal requirements, taxes, refunds, and pricing have been checked.
- FR-22: Activate entitlements only after verified, idempotent payment-provider events.
- FR-23: Define cancellation, failed renewal, refund, grace period, and expiry behavior before implementation.

## Non-functional requirements

| ID | Requirement | Target / validation |
|---|---|---|
| NFR-1 | Connection time | Measure p50/p95 on real networks before setting a committed target |
| NFR-2 | Throughput | Benchmark the chosen VPS and client devices; do not assume a fixed rate |
| NFR-3 | Reliability | Existing tunnel should not depend on API availability after provisioning |
| NFR-4 | Revocation | Define and test a measurable revocation SLA if accounts are used |
| NFR-5 | Data at rest | Restrict access; encrypt sensitive data and backups |
| NFR-6 | Data in transit | HTTPS/TLS for API; secure node management channel |
| NFR-7 | Logging | Minimize logs; do not log browsing destinations, payloads, or DNS queries by default |
| NFR-8 | Safe failure | No false “Connected” state; route behavior after failure is documented and tested |
| NFR-9 | Updates | Signed releases and verified update process |
| NFR-10 | Compatibility | Test supported Windows/macOS versions on clean machines |

## Platform scope
- Phase 1: Windows 10/11 and current supported macOS versions, with versions finalized after dependency review.
- Android/iOS/Linux: out of scope for the initial desktop MVP.

## Acceptance criteria for the technical MVP
A test user on each target OS can establish and terminate a tunnel, confirm expected routing, pass DNS/IPv4/IPv6 leak checks for the chosen policy, recover from network changes, and uninstall without leaving unsafe or undocumented network configuration.

Network policies still apply. The application must not claim it can guarantee access to every blocked destination.

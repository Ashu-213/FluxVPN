# 02 — Architecture & Workflow

## 1. System overview

```text
                    WINDOWS CLIENT
       React + TypeScript + Tauri desktop shell
                         |
             Rust app / native integration
                         |
          Trusted WireGuard Windows integration
                         |
                         | encrypted tunnel
                         |
                    LINUX VPN NODE
                 Ubuntu + WireGuard
                         |
              forwarding / firewall / NAT
                         |
                      Internet


                     macOS CLIENT
       React + TypeScript + Tauri desktop shell
                         |
             Rust app / native integration
                         |
        Apple Network Extension (packet tunnel)
              + WireGuard implementation
                         |
                         | encrypted tunnel
                         |
                    LINUX VPN NODE
```

The desktop UI can be shared. The tunnel lifecycle and operating-system integration cannot be assumed identical across Windows and macOS.

## 2. Optional control plane

```text
Windows/macOS app --HTTPS--> Node.js API ----> PostgreSQL
                                   |
                                   +----> Server metadata / device authorization
                                   |
                                   +----> Secure provisioning workflow

Client ===== encrypted VPN tunnel =====> Ubuntu WireGuard node =====> Internet
```

Keep the **control plane** (accounts, authorization, metadata) separate from the **data plane** (VPN packets). The VPN tunnel should not need the API to remain available for every packet. Existing tunnels should behave predictably if the API is temporarily unavailable.

For a local prototype, accounts, payments, Redis, and a worker are not mandatory. Add them only when a real requirement justifies the complexity.

## 3. Connect flow
1. User opens the desktop app.
2. App checks local prerequisites and retrieves server metadata if applicable.
3. If accounts are enabled, user authenticates and the API verifies entitlement.
4. The client obtains or uses a device-specific configuration; private keys remain on the device.
5. The platform-specific tunnel integration starts WireGuard.
6. The client verifies tunnel status and expected routes/DNS before showing “Connected.”
7. On disconnect, the client stops the tunnel and verifies that system networking has returned to the documented state.

## 4. Failure behavior
- API unavailable: existing tunnel behavior is independent of API availability; new provisioning may fail with a clear message.
- VPN node unavailable: show a clear error; add failover only after it is tested.
- Network changes: reconnect safely and avoid a stale connected state.
- DNS or route setup failure: fail closed according to the documented product policy.
- App crash or OS sleep/wake: verify tunnel state on restart/resume.
- Update failure: preserve a recoverable previous version or provide documented recovery.

## 5. Deployment
- One Linux VPN node for the first technical test.
- Control API can run locally or on a small separate service during development.
- Do not put the VPN node behind a generic HTTP reverse proxy unless the selected protocol and architecture explicitly support it.
- Use SSH key-based administration and restrictive firewall rules.
- Add a second node only after a single-node benchmark and recovery drill.

## 6. Roadmap
1. Validate network and policy assumptions.
2. Prove WireGuard on Windows and macOS using official clients.
3. Build shared desktop UI.
4. Implement native tunnel lifecycle per OS.
5. Add optional API and device authorization.
6. Security, privacy, packaging, and release testing.
7. Limited authorized pilot.

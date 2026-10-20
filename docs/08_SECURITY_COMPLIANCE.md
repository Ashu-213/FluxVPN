# 08 — Security, Privacy & Compliance

This is an engineering checklist, not legal advice. Get qualified legal advice before operating a public or paid VPN service, particularly in India.

## 1. Threats and mitigations

| Threat | Mitigation |
|---|---|
| VPN private key exposure | Generate/store keys on the device where supported; never log or commit them |
| Unauthorized access | Authentication and server-side authorization if accounts are used |
| Device sharing/compromise | Per-device identity, revocation, and documented recovery |
| API abuse | Rate limits, input validation, request limits, monitoring |
| Compromised VPN node | Hardened OS, least privilege, rapid rebuild, key rotation |
| Admin credential theft | Separate admin access, MFA, restricted management network |
| DNS/IPv6 leak | Explicit routing design and repeatable leak tests |
| False connected state | Native tunnel status is authoritative |
| Malicious update | Signed artifacts and verified update process |
| Data loss | Encrypted backups and restore drills |
| Exit-node abuse | Acceptable-use policy, abuse contact, operational process, provider terms review |

## 2. Client security
- Use trusted WireGuard implementations; do not create custom cryptography.
- Store secrets using OS-appropriate protected storage.
- Do not expose arbitrary shell commands to the UI.
- Restrict Tauri capabilities and IPC commands to the minimum needed.
- Validate all data crossing the UI/native boundary.
- Test permission denial, app crash, sleep/wake, network changes, and uninstall.
- Implement a kill switch only if the platform-specific behavior is proven and documented.
- Sign releases and protect the update pipeline.
- Display third-party license notices and review redistribution obligations.

## 3. Server security
- SSH key-only access; disable direct root login.
- Firewall default-deny and expose only required services.
- Keep management services on a private network or strict allowlist.
- Apply security updates and monitor vulnerabilities.
- Separate VPN traffic processing from account/control services where practical.
- Restrict service privileges and file permissions.
- Protect configuration backups and rotate credentials after suspected compromise.
- Monitor bandwidth, resource use, service health, and abuse reports.
- Verify VPS provider rules permit the intended VPN operation.

## 4. API and data security (if API is built)
- HTTPS/TLS and secure session handling.
- Rate limit authentication, provisioning, and administrative endpoints.
- Store token hashes rather than reusable bearer tokens where applicable.
- Validate input and use parameterized database queries.
- Enforce authorization and ownership checks on every resource.
- Never log passwords, OTPs, access tokens, private keys, or complete VPN configs.
- Separate admin authentication and require MFA.
- Verify payment webhook signatures and process events idempotently if billing is added.

## 5. Privacy
- Collect only data needed to operate the service and meet verified legal obligations.
- Avoid collecting browsing history, destination domains, payloads, and DNS queries by default.
- Clearly document connection metadata, purpose, access controls, and retention.
- Publish an accurate privacy notice; do not claim “no logs” unless that claim is precisely defined and true.
- Provide a process for account deletion and explain records that must legally be retained.
- Encrypt sensitive data and backups and restrict access.
- Have an incident-response and breach-notification plan.

## 6. Legal and operational checks before public/paid launch
- Review university network policy and obtain authorization where required.
- Obtain legal advice on applicable Indian VPN, cybersecurity, privacy, consumer, tax, and record-retention obligations.
- Verify the hosting provider's acceptable-use policy.
- Confirm payment processor approval for the actual business category before integrating payments.
- Publish terms, privacy policy, acceptable-use/abuse policy, and support contact.
- Define complaint handling and incident response.

Do not assume that hosting outside India automatically removes obligations to Indian users. Do not treat draft regulatory notes as a definitive legal interpretation.

## 7. Pre-launch gate
- [ ] Windows and macOS tunnel tests pass.
- [ ] DNS, IPv4, and IPv6 routing behavior is verified.
- [ ] Network change, sleep/wake, server outage, crash, and uninstall tests pass.
- [ ] Device revocation is tested if accounts exist.
- [ ] No secrets in repository, logs, screenshots, or release artifacts.
- [ ] Signed installers and update verification tested.
- [ ] Backup restore and server rebuild rehearsed.
- [ ] Provider terms, university policy, and legal requirements reviewed.
- [ ] Public claims accurately describe limitations and data handling.

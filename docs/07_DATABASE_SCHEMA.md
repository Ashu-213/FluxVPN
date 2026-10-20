# 07 — Database Schema (Optional)

**Do not add a database until there is a real need for accounts, device authorization, or subscriptions.** A single-server technical prototype can use manually provisioned peers while keeping keys out of source control.

This file is a logical schema plan, not production-ready SQL.

## Minimal account/device model

### `users`
- `id`: UUID primary key
- `email`: unique, verified identity if email login is used
- `status`: active, suspended, deleted
- `created_at`, `updated_at`, `deleted_at`

### `devices`
- `id`: UUID primary key
- `user_id`: foreign key to users
- `name`: user-friendly device name
- `platform`: `windows` or `macos`
- `public_key`: device public key only, if compatible with selected client integration
- `status`: active or revoked
- `created_at`, `revoked_at`

### `servers`
- `id`: UUID primary key
- `name`, `region`, `endpoint`, `status`
- `capacity metadata`: only metrics needed for server health/selection
- `created_at`, `last_heartbeat_at`

### Optional `audit_events`
- `id`, `actor_id`, `action`, `target_id`, `created_at`, sanitized metadata

### Optional paid-service tables
Add `plans`, `subscriptions`, `payments`, and `webhook_events` only after payment provider acceptance and legal review. Store monetary values in integer minor units (paise for INR); never store card data.

## Invariants
- Each device belongs to one user when accounts are enabled.
- Device ownership is checked on every device operation.
- Revoked devices cannot receive fresh configuration.
- Device private keys are never stored in the database.
- Payment webhook event IDs are unique and processed idempotently.
- Do not store browsing destinations, URLs, payloads, or DNS queries by default.
- Define retention and deletion policies before collecting personal data.

## Migration practices
- Use numbered forward-only migrations.
- Test migrations against a disposable database.
- Back up before production migrations and rehearse restoration.
- Use least-privilege database credentials.
- Encrypt backups and restrict access.

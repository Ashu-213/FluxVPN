# 05 — Folder Structure

Suggested monorepo for a Windows/macOS desktop app. Start with the desktop client and a basic server runbook; do not create empty services merely to match the diagram.

```text
flux/
├── README.md
├── apps/
│   ├── desktop/
│   │   ├── src/                    # React + TypeScript UI
│   │   │   ├── components/
│   │   │   ├── screens/
│   │   │   ├── state/
│   │   │   ├── services/           # API client; tunnel command interface
│   │   │   └── styles/
│   │   └── src-tauri/
│   │       ├── src/                # Rust command/state layer
│   │       ├── capabilities/
│   │       ├── icons/
│   │       └── tauri.conf.json
│   └── api/                        # Optional until accounts are needed
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── db/
│       │   └── config/
│       ├── test/
│       └── package.json
├── packages/
│   └── shared/                     # Shared types/validation only
├── infra/
│   ├── server/                     # Sanitized WireGuard templates/runbooks
│   ├── docker/                     # Docker Compose configurations
│   ├── aws/                        # Production infrastructure configs
│   ├── scripts/
│   └── monitoring/
├── tests/                          # Integration and end-to-end tests
├── docs/
│   ├── 00_README.md
│   ├── 01_REQUIREMENTS.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_DESIGN.md
│   ├── 04_UI_THEME.md
│   ├── 05_FOLDER_STRUCTURE.md
│   ├── 06_IMPLEMENTATION_PLAN.md
│   ├── 07_DATABASE_SCHEMA.md
│   └── 08_SECURITY_COMPLIANCE.md
├── .github/
│   └── workflows/
│       ├── checks.yml
│       └── desktop-build.yml
├── .env.example
├── .gitignore
└── package.json
```

## Platform-specific implementation
The UI can be shared, but maintain clearly separated adapters for:
- Windows WireGuard tunnel lifecycle.
- macOS Network Extension lifecycle.

Do not put operating-system-specific tunnel behavior directly into React components. Define a narrow interface and test each adapter independently.

## Conventions
- Branches: `main`, `feat/*`, `fix/*`.
- Conventional Commits are recommended.
- Secrets and live VPN keys never enter Git.
- Use numbered forward-only database migrations if a database is added.
- CI should run formatting, linting, unit tests, dependency checks, and build checks.
- Keep deployment configuration separate from development configuration.

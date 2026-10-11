# AllPlay

**One Beat. Every Device.**

AllPlay is a planned synchronized music platform with account-free rooms and an administrator-managed music library. This repository currently implements **Phase 1: project initialization only**. Room creation, authentication, uploads, playback, and synchronization are not implemented.

## Requirements

- Windows 11 or another Node.js-supported development OS.
- Node.js 24.18.1 or newer in the 24.x line; this workspace was initialized with 24.19.0.
- npm 11.x; lockfile generated with 11.17.0.
- Git. PostgreSQL, Docker and FFmpeg are not required for Phase 1.

## WebStorm / Windows setup

Open the repository root, not an individual app. Under **Settings > Languages & Frameworks > Node.js**, choose a compatible Node interpreter and npm installation. Run commands in the root Terminal. PowerShell may block `npm.ps1`; use `npm.cmd`, without changing execution policy.

```powershell
npm.cmd ci
Copy-Item -LiteralPath .env.example -Destination .env
npm.cmd run dev
```

Copy `.env.example` only when `.env` does not already exist. The local defaults also work without an `.env` file. Never commit real secrets.

- Web shell: <http://localhost:3000>
- Same-origin liveness: <http://localhost:3000/api/v1/health>
- Direct backend liveness: <http://127.0.0.1:3001/api/v1/health>

The page explicitly labels itself as the Phase 1 shell. Health reports process liveness only. There are no working Create Room or Join Room buttons yet. Socket.IO transport accepts only the configured `WEB_ORIGIN`; application connections are deliberately rejected until Phase 3 session authorization exists. `localhost` and `127.0.0.1` are different origins.

Both servers bind to loopback by default. Stop development with Ctrl+C. Ports in use cause an error; do not terminate unrelated processes. Shared packages compile before startup. After editing a shared package during Phase 1, restart `npm.cmd run dev` to rebuild its output.

## Checks

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run smoke:dev
npm.cmd run smoke:production
```

Run smoke commands with ports 3000 and 3001 free and no other Next.js build/dev process running. They launch and clean up their own processes, test real HTTP/CSS/API responses, and verify graceful backend shutdown. The production smoke uses the already-built app and does not claim a production deployment or real-device audio verification. Rebuild after changes before running it.

For an npm Run Configuration in WebStorm, select the root `package.json` and the `dev`, `test`, `typecheck`, or `build` script. Root scripts respect dependency order; avoid directly starting an app on a fresh clone before building shared packages.

## Structure and configuration

- `apps/web`: Next.js App Router and Tailwind shell.
- `apps/server`: Express liveness, bounded Socket.IO foundation and shutdown handling.
- `packages/shared`: public constants, health schema and empty socket contract boundaries.
- `packages/audio-sync`: clock-related type boundary only; no synchronization algorithm yet.
- `tests`: environment and live-server integration tests.
- `scripts/smoke.mjs`: local development/production HTTP smoke runner.
- `docs`: approved architecture, phase plan and actual progress.

Root `.env` is loaded by both apps. `API_INTERNAL_URL` is server-only and configures Next.js rewrites; build again if its production value changes. Do not place secrets in `NEXT_PUBLIC_*` variables. Production backend configuration requires an HTTPS `WEB_ORIGIN`; TLS termination and deployment configuration belong to Phase 11. Local HTTP defaults are for development.

Dependencies are pinned and locked. ESLint 9 is temporarily retained because the current Next.js React/import/accessibility lint dependencies do not declare ESLint 10 compatibility. See [SECURITY.md](docs/SECURITY.md) for the known development-only dependency advisory and upgrade criteria.

## Development agreement

Only one explicitly approved phase is implemented at a time. Each phase includes relevant validation and a progress update. Phase 2 needs separate approval. See [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) and [PROGRESS.md](docs/PROGRESS.md).

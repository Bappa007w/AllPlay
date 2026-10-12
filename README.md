# AllPlay

**One Beat. Every Device.**

AllPlay is a planned synchronized music platform with account-free rooms and an administrator-managed music library. This repository implements **Phase 3: Room System**: real guest room creation/joining, secure Host identity, live presence, invitations, reconnection and room closure. Officer management, database persistence, administrator authentication, uploads, playback and audio synchronization are not implemented.

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

- Homepage: <http://localhost:3000>
- Create interface: <http://localhost:3000/create>
- Join interface: <http://localhost:3000/join>
- Same-origin liveness: <http://localhost:3000/api/v1/health>
- Direct backend liveness: <http://127.0.0.1:3001/api/v1/health>

Create a room with a display name, then share its `/room/[roomId]` invitation. Test a second participant in an incognito window or another browser profile: tabs share a guest cookie and the newest room tab takes over that identity. Refresh preserves the Host role. The Host closes the room; participants can leave. Room codes are not Host credentials. Losing the cookie loses anonymous ownership.

Local defaults store rooms in memory; restarting the backend deletes them. The optional Redis mode shares room state and sessions across instances. Defaults are 20 people, 24-hour expiry, 10-minute Host absence grace and 2-minute participant reconnection reservation. Only one active room per browser session; return to your current room and leave/close it before creating another. Music and timeline artwork remain explicitly conceptual. Health reports process liveness only. `WEB_ORIGIN` must match the browser origin exactly: `localhost` and `127.0.0.1` are different origins. Use localhost:3000 with the default configuration.

Both servers accept connections from the local network by default. Stop development with Ctrl+C. Ports in use cause an error; do not terminate unrelated processes. Shared packages compile before startup. After editing a shared package during Phase 1, restart `npm.cmd run dev` to rebuild its output.

## Checks

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:ui
npm.cmd run build
npm.cmd run smoke:dev
npm.cmd run smoke:production
```

Run smoke commands with ports 3000 and 3001 free and no other Next.js build/dev process running. They launch and clean up their own processes, test real HTTP/CSS/API responses, and verify graceful backend shutdown. The production smoke uses the already-built app and does not claim a production deployment or real-device audio verification. Rebuild after changes before running it.

UI tests use installed Google Chrome through Playwright, with desktop and mobile-emulated projects. Install Google Chrome before running `test:ui`; no extension-enabled user profile is used. Tests own separate web/backend servers on 3100/3101 and use `.next-e2e` build output, leaving development servers untouched. Those test ports must be free. Tests include real multi-context room journeys and axe scans; passing these is not a complete accessibility certification or physical-phone/acoustic test.

For an npm Run Configuration in WebStorm, select the root `package.json` and the `dev`, `test`, `test:ui`, `typecheck`, or `build` script. Root scripts respect dependency order; avoid directly starting an app on a fresh clone before building shared packages.

## Structure and configuration

```text
AllPlay/
├── frontend/          # Pages, components and browser UI
├── backend/           # REST API, rooms and Socket.IO
├── shared/
│   ├── contracts/     # Shared types and input schemas
│   └── audio-sync/    # Audio timing boundary (future implementation)
├── tests/
├── scripts/
├── docs/
├── Dockerfile
├── vercel.json
└── package.json
```

Run npm commands from the root. Existing `@allplay/*` package names stay unchanged; the folders are simpler without changing import contracts. Edit source under `src/`, never generated `dist/` files.

- `frontend`: Next.js routes, Tailwind theme, local Manrope font, Radix/CVA button primitive, Lucide icons and responsive UI.
- `backend`: Express room/session routes, in-memory lifecycle service, authenticated Socket.IO and shutdown handling.
- `shared/contracts`: public room/health types, strict input schemas and typed socket contracts.
- `shared/audio-sync`: clock-related type boundary only; no synchronization algorithm yet.
- `tests`: environment, live-server integration and browser UI/accessibility tests.
- `scripts/smoke.mjs`: local development/production HTTP smoke runner.
- `docs`: approved architecture, phase plan and actual progress.

Root `.env` is loaded by both apps. `API_INTERNAL_URL` is server-only and configures Next.js rewrites; build again if its production value changes. Do not place secrets in `NEXT_PUBLIC_*` variables. Production backend configuration requires an HTTPS `WEB_ORIGIN`; TLS termination and deployment configuration belong to Phase 11. Local HTTP defaults are for development.

## Container deployment

For the approved zero-budget Vercel setup, use [VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md). The root `vercel.json` prepares frontend and backend as two Services in one Vercel project. Redis is required on Vercel; real Redis and deployed WebSocket behavior still require verification. The Dockerfile below is an alternative local/container workflow, not the Vercel build entrypoint.

The included `Dockerfile` builds and runs the web and API services in one container. Set `WEB_ORIGIN` to the exact public HTTPS origin. The hosting platform should route public traffic to the `PORT` environment variable (3000 by default); port 3001 remains internal to the container.

```powershell
docker build -t allplay .
docker run --rm -p 3000:3000 -e WEB_ORIGIN=https://allplay.example.com allplay
```

For a real deployment, replace the example origin with the deployed URL and terminate TLS at the hosting platform or reverse proxy. WebSocket upgrades for `/socket.io/` must be enabled. Because rooms are currently stored in memory, use one container instance; restarts remove active rooms.

Dependencies are pinned and locked. ESLint 9 is temporarily retained because the current Next.js React/import/accessibility lint dependencies do not declare ESLint 10 compatibility. See [SECURITY.md](docs/SECURITY.md) for the known development-only dependency advisory and upgrade criteria.

## Development agreement

Only one explicitly approved phase is implemented at a time. Each phase includes relevant validation and a progress update. Phase 3 and free deployment preparation were approved; Phase 4 and later product features still require approval. See [DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md) and [PROGRESS.md](docs/PROGRESS.md).

## Browser extension troubleshooting

If a hydration warning shows injected `crxlauncher` attributes and a `chrome-extension://` stack, verify in Chrome Guest mode. Those attributes are not in AllPlay's source. Disable that extension for localhost if the warning disappears. We do not suppress hydration warnings globally; browser tests watch for actual client errors in a clean context.

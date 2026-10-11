# Testing

## Phase 1 checks

Run from the repository root with npm.cmd on Windows:

| Command                      | Evidence                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| npm.cmd run lint             | ESLint and Next rules; warnings fail                              |
| npm.cmd run format:check     | Prettier consistency                                              |
| npm.cmd run typecheck        | Package, backend, web and test types                              |
| npm.cmd run test             | Environment validation and live HTTP/Socket.IO integration        |
| npm.cmd run build            | Compiled packages/server and production Next build                |
| npm.cmd run smoke:dev        | Real dev servers, shell/CSS, API/socket rewrites, graceful stop   |
| npm.cmd run smoke:production | Built web/server HTTP smoke and graceful stop                     |
| npm.cmd audit --omit=dev     | Production dependency advisories                                  |
| npm.cmd audit                | All dependencies; known lint-chain advisory documented separately |

Smoke checks require free ports 3000/3001. They never kill a process already occupying those ports. The runner only cleans up the child process IDs it started. Both dev and production smoke verify polling and WebSocket proxy connections reach the deliberately rejecting application boundary. Do not run Next build/typegen and smoke/dev simultaneously because they share generated output. Stop normal dev servers before smoke runs.

Unit cases cover default configuration, invalid ports/origins, HTTPS production requirements and avoiding secret reflection. Integration cases bind ephemeral ports and cover health/404 contracts, allowed/unapproved/missing socket origins, application connection rejection and idempotent shutdown. These are real HTTP/socket checks, not mocks of implemented functions.

Health means the process responds, not that future database/storage/audio components are ready. Production smoke is local HTTP routing, not a TLS deployment test. No acoustic tests are claimed in Phase 1.

## Planned coverage

- Unit: CSPRNG code behavior/collisions, role matrix, Officer slots, queue ordering, clock filtering, timeline and correction math.
- Integration: create/join, concurrent third-Officer promotion, demotion during queued commands, forbidden operations, stale revisions, retry deduplication, login/logout, uploads, restart/reconnect.
- Database: relational constraints, transaction races, migration and restoration.
- E2E: independent Host/Officer/Participant browser contexts through creation, joining, music, controls and closure.
- Security: CSRF, forged roles, revoked sessions, origin attacks, oversized payloads, hostile uploads and rate limits.
- Load: initial 50-room/20-device scenario, commands, reconnect burst, cleanup and database pool behavior. This is a test scenario, not a capacity claim.
- Accessibility: keyboard, focus, contrast, announcements and reduced motion.

## Real-device audio matrix

Windows Chrome, Android Chrome and iPhone Safari; same Wi-Fi and different networks; built-in speakers and Bluetooth; foreground, background, lock and resume; late join, seek, track changes, network loss and long sessions. Record acoustic impulse timing with controlled geometry. Report pairwise p50/p95/max and distinguish clock estimate, render scheduling, command delivery and measured acoustic output.

Playwright does not prove acoustic synchronization. If physical devices are unavailable, report that gap explicitly and do not certify release quality. Actual results belong in PROGRESS.md after every phase.

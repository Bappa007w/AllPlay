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

## Phase 2 browser verification (historical)

`npm.cmd run test:ui` builds shared packages and runs Playwright against the web app. It requires installed Google Chrome, uses clean browser contexts and covers desktop and Pixel-sized mobile emulation. When no dev server is present it starts/stops its own server. An existing local server may be reused; CI requires a free port. It does not need the room backend.

The ten cases (five in each viewport project) cover:

- Homepage links, mobile menu, Escape/focus restoration, FAQ and preview disclosures; no client console errors.
- Create form validation, Unicode names, normalization and explicit no-room-created feedback.
- Join ID format/normalization, invalid characters and no-room-lookup feedback.
- 320px overflow, keyboard skip links, reduced motion and not-found navigation.
- axe WCAG 2/2.1 A/AA scanning of all three core pages. Next.js developer tooling is excluded from the scan, not application content.

Screenshots are generated in test-results for homepage/form review. Passing automated accessibility checks is not a complete manual accessibility audit. Mobile emulation is not physical Android or iPhone/Safari certification. No command or acoustic synchronization is tested in this phase.

## Phase 3 room verification

`npm.cmd run test` covers the real HTTP/Socket.IO runtime on ephemeral ports plus the room service with injectable time. Cases cover code/name validation, idempotent create retries, token non-disclosure, Origin and CSRF rejection, role injection, membership privacy, simultaneous admissions, Host-only close, stale revisions, tab takeover, reconnect identity, expired sessions, two-minute seat cleanup, ten-minute Host grace, 24-hour expiry, rate windows and restart credential invalidation. Polling and WebSocket application flows are tested separately. A same-origin browser polling GET without Origin is accepted only with matching Referer and fetch metadata; foreign or incomplete metadata is rejected.

`npm.cmd run test:ui` now owns isolated backend/web servers on 3101/3100, with `.next-e2e` output; these ports must be free. One worker avoids competing cold compilations on a Windows development workstation. Each test has a 90-second budget and assertions retry up to 15 seconds. No test retries conceal failures. Desktop and mobile-emulated Chrome cover real creation, unavailable-room errors, invitation join, presence, Host reload, network recovery, tab takeover, participant leave/rejoin and Host closure. axe scans include the room dashboard. Screenshots/traces remain under ignored `test-results`.

Manual verification: run `npm.cmd run dev`, open `http://localhost:3000/create`, create a room, copy the invitation into a separate incognito/profile session, join, reload the Host, leave/rejoin as guest and close as Host. A second tab in the same profile should take over the existing identity rather than add another participant. Restart the backend and confirm the old room becomes unavailable. Do not claim acoustic or physical-device validation from these tests.

## Planned later coverage

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

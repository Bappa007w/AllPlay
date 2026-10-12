# Development plan

Phases 0–3 were explicitly approved. Phase 3 implements the in-memory Room System; Phase 4 is not approved. Approval never advances automatically to another phase.

| Phase | Scope                                                                | Exit evidence                                           |
| ----- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| 0     | Requirements, architecture, protocol, database, audio, UX            | Explicit approval                                       |
| 1     | Workspaces, Next.js, backend, TS, Tailwind, lint, env, docs          | Checks, build, local smoke                              |
| 2     | Homepage, navigation, create/join UI, reusable components            | Responsive and accessibility checks                     |
| 3     | Guest/Host sessions, room creation/joining, socket attach, lifecycle | Integration tests; memory restart limitation documented |
| 4     | Server permissions, Officer slots, participant management            | Concurrent promotion and authorization tests            |
| 5     | PostgreSQL, Prisma, migrations, persisted rooms, admin login         | Auth, transaction and restart tests                     |
| 6     | Storage, validated uploads, media processing, metadata, catalog      | Upload and storage integration tests                    |
| 7     | Shared controls, queue, seek, auto-advance, timeline                 | Ordering and playback state tests                       |
| 8     | Clock estimation, scheduled starts, correction, diagnostics          | Simulated and real-device timing evidence               |
| 9     | Full room panels, Officer/queue UI, settings, reconnect UX           | Responsive multi-role journeys                          |
| 10    | Security, load, compatibility and release validation                 | Recorded results and limitations                        |
| 11    | HTTPS/WSS deployment, monitoring, backups, restore guide             | Deployment smoke and restore rehearsal                  |

For each phase: explain scope and affected files in Bengali; obtain approval; implement; run relevant tests; document actual outcomes and WebStorm verification; stop before the next phase.

Do not defer all tests to Phase 10. Phase 7 shared playback is not verified advanced synchronization. Do not display mock product actions as working functionality.

## Phase 1 boundary

Implemented foundation is limited to a clearly labeled web shell, liveness endpoint, a fail-closed socket foundation, environment validation, build tooling and documentation. No database package/migrations, credentials, room handlers, upload workflow or audio algorithms are implemented yet. Docker Compose is deferred until a service actually needs it. shadcn/ui, Lucide and Motion will be added when Phase 2 components use them.

## UI blueprint for the next phases

Dark-first midnight/charcoal surfaces, electric blue/violet accents, restrained gradients, consistent spacing, visible focus and reduced motion. English identifiers and initial product copy; development explanations in Bengali.

Desktop room: top room/invite/status/settings bar, library on the left, player in the center, queue and participants on the right. Mobile: Player, Music, Queue and Participants tabs, with an audio engine that survives tab switches. Device-local controls remain available to every role. Connection and synchronization statuses are separate.

| Route                | Planned surface                                    |
| -------------------- | -------------------------------------------------- |
| `/`                  | Homepage, Features and How It Works                |
| `/create`            | Host display name and creation                     |
| `/join`              | Room ID and display name                           |
| `/room/[roomId]`     | Join gate, player dashboard and lifecycle states   |
| `/admin/login`       | Administrator sign-in                              |
| `/admin/dashboard`   | Library/storage/room metrics                       |
| `/admin/music`       | Catalog table, upload/edit dialogs, filters        |
| `/admin/settings`    | Validated global settings                          |
| `/privacy`, `/terms` | Actual deployment policies; owner details required |

Required states include loading, empty library/queue, search no results, upload progress/processing/error, audio activation, preparation, synchronization, reconnect, reduced precision, room full/closed/expired and removal. Room settings and invitation details use dialogs/drawers.

## Phase 2 implementation decisions

The homepage is a Server Component with original CSS device artwork, feature descriptions, a four-step guide and native accessible FAQ disclosures. Client components are limited to navigation and entry forms. A locally bundled Manrope variable font avoids third-party font requests. Lucide supplies icons; reusable local shadcn-style Button/Input primitives use Radix Slot, CVA and class merging. CSS transitions respect reduced-motion preferences; a Motion dependency was unnecessary for these interactions.

Create/join forms validate locally, focus invalid fields, associate errors with inputs and announce feedback. They do not create sessions, look up rooms or save entered data. The UI-preview room alphabet is human-friendly Base32: A–Z excluding I/O plus digits 2–9, 12 characters; separators and lowercase normalize on submit. Phase 3 must share the finalized contract with the server and replace this UI-only validation. Forms explicitly disclose unavailable room functionality.

Desktop, tablet and narrow-mobile breakpoints are defined; 320px overflow, keyboard skips, menu Escape handling, local validation, clean-context hydration and WCAG A/AA automated checks are covered by Playwright/axe. Visual browser review supplements the tests. Authentication and socket authorization remain the Phase 1 fail-closed foundation.

## Explicitly deferred features

Registration, profiles, favorites, saved playlists, room passwords, spatial/stereo features, EQ, visualizer, chat, public discovery, Host transfer and PWA require a separate request.

Hosting vendor, domain, storage account and legal owner/jurisdiction remain deployment decisions; they do not block Phase 1.

# REST API design

## Implemented in Phase 1

`GET /api/v1/health` returns HTTP 200 with `status: "ok"`, `service: "allplay-server"`, and `protocolVersion: 1`. It is liveness only and sends `Cache-Control: no-store`. All other application paths return HTTP 404 with a safe `NOT_FOUND` error.

No admin, room, library or upload endpoints below are implemented yet.

## Target endpoints

| Method and path                               | Purpose                                                      |
| --------------------------------------------- | ------------------------------------------------------------ |
| POST /api/v1/rooms                            | Atomically create room and Host membership; set guest cookie |
| POST /api/v1/rooms/:roomId/join               | Validate room/capacity, establish guest membership           |
| GET /api/v1/rooms/:roomId/state               | Authorized full snapshot                                     |
| GET /api/v1/music                             | Available catalog with cursor pagination/search              |
| POST /api/v1/music/:songId/playback-url       | Validate active membership and issue scoped media URL        |
| POST /api/v1/admin/login                      | Validate credentials and create session                      |
| POST /api/v1/admin/logout                     | Revoke server-side session and cookie                        |
| GET /api/v1/admin/session                     | Current validated administrator                              |
| POST /api/v1/admin/uploads                    | Bounded upload intent                                        |
| POST /api/v1/admin/uploads/:uploadId/complete | Verify object and schedule validation/processing             |
| PATCH /api/v1/admin/music/:songId             | Metadata/availability update                                 |
| DELETE /api/v1/admin/music/:songId            | Controlled, reference-aware deletion                         |
| GET /api/v1/admin/stats                       | Storage, catalog and basic room statistics                   |
| GET/PATCH /api/v1/admin/settings              | Read/change validated settings                               |

Use Zod contracts, bounded request bodies, opaque public IDs and safe error envelopes: `error.code`, `error.message`, and optional field errors. Never include SQL, stack traces, credentials or signed URLs in failures. Mutation retries use idempotency identifiers where needed, especially room creation and upload completion.

Room creation and joining use REST to establish HttpOnly cookies. Socket attachment consumes the established session. All transport adapters call the same domain services.

State-changing cookie-authenticated requests require CSRF and Origin checks. Admin requests always validate a server-side session. Public catalog is read-only; media URL issuance requires membership. Production browser/API routing is same-origin, while CDN CORS is configured separately.

## Asset flow

Admin intent -> private quarantine upload -> completion verification -> bounded media inspection/transcoding -> immutable playback/artwork assets -> database READY/AVAILABLE -> public catalog. Only owned/licensed music is accepted. Direct object upload credentials constrain key, size and validity period. Failed processing never publishes a playable song.

Audio delivery must support Range/206, correct content type, controlled CORS, cache validation and URL refresh. Deactivation prevents new selections; downloaded data cannot be revoked. Playback statistics count server-committed starts, not verified human listening.

# Database design

Target design only. No database dependency, schema, migration or connection exists in Phase 1. PostgreSQL and Prisma arrive in Phase 5.

| Model              | Key fields and relationships                                                       |
| ------------------ | ---------------------------------------------------------------------------------- |
| AdminUser          | Unique email, passwordHash, disabledAt, timestamps                                 |
| AdminSession       | Unique tokenHash, adminUserId, expiry, lastSeenAt, revokedAt                       |
| GuestSession       | Unique tokenHash, expiry, revocation                                               |
| Room               | Internal ID, unique publicCode, lifecycle, capacity, revision, expiry              |
| RoomParticipant    | roomId, guestSessionId, displayName, role, officerSlot, membership state           |
| RoomPlaybackState  | Unique roomId, track/asset, status, anchor, generation, pending transition         |
| RoomQueueItem      | Item ID, roomId, songId, ordering position, addedBy                                |
| Song               | Title, artist, album, genre, availability and timestamps                           |
| MusicAsset         | songId, kind, object key, MIME/codec, bytes, duration, checksum, processing status |
| UploadJob          | Upload intent, expected object, state, failure reason                              |
| RoomCommandReceipt | roomId, commandId, actor, committed revision and retry result                      |
| RoomEventLog       | roomId, revision, actor, event type, bounded payload                               |
| AdminAuditLog      | Administrator, action, target, timestamp                                           |
| AppSetting         | Validated global configuration                                                     |
| SongDailyStat      | Song/date and committed start count                                                |

Keep file facts on MusicAsset. Catalog DTOs join Song to its canonical playback and artwork assets. Artist/album/genre are plain metadata initially, without unnecessary taxonomy entities. Song duration is based on the canonical asset. Repeated song IDs in a queue are allowed and distinguished by queue item ID.

## Constraints

- Unique public code and collision retry.
- Unique `(roomId, guestSessionId)` membership.
- Partial unique active Host per room; lifecycle transactions additionally enforce exactly one Host for an open room.
- Officer slot restricted to 1, 2 or 3, unique `(roomId, officerSlot)`, and role/slot consistency checks. Removal/demotion clears the slot.
- Unique `(roomId, commandId)` for mutation deduplication.
- Revision compare-and-swap plus transaction for queue/playback/role mutations.
- Foreign keys and explicit deletion policies; no accidental asset deletion through broad cascades.
- Reviewed SQL migrations for constraints/indexes Prisma cannot represent directly.

Index session expiry, public code, room expiry/status, membership lookup, queue ordering, event revision and catalog status/search. Start with PostgreSQL search/indexing appropriate to measured catalog size; no external search service.

## Durability and recovery

Persist transitions, not per-second progress. Commit state, receipt and audit event together before broadcasting. A reconnect retrieves the latest snapshot even if a broadcast was lost. A server restart creates a new clock epoch, restores membership/queue and leaves playback paused/recovering; process-relative timestamps cannot survive a restart unchanged.

Timers, socket IDs, clock samples, ready devices and presence heartbeats are transient. Avoid writing each heartbeat to PostgreSQL. Expired session/event retention and cleanup are bounded and finalized when persistence is implemented; sensitive tokens and raw signed URLs must never enter audit payloads.

Deactivate songs before deletion. Reference-aware cleanup reconciles database and object storage failures. Backups must cover database and storage metadata/versioning; restore rehearsal is a Phase 11 exit requirement.

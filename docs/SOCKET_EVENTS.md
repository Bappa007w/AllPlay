# Socket.IO protocol

## Implemented Phase 4 additions

Host-only `officer:promote`, `officer:demote` and `participant:remove` take strict `{ requestId: UUID, expectedRevision, participantId: UUID }` and acknowledge `Result<Membership>` for the actor. Actor identity and room come from the authenticated socket. The Host cannot be targeted. All changes increment revision and broadcast `room:state`; replay is rejected as stale. No role-command receipt cache is retained: after timeout inspect authoritative state before a new deliberate action.

Removal commits membership revocation before targeted `participant:removed` and adapter disconnection. A removed member cannot reconnect automatically; a fresh explicit join is allowed as Participant. This is removal, not a durable ban. Disconnected reserved Officers count toward the three-Officer limit until they leave, are removed/demoted, or expire. Count and mutation share the coordinator's atomic compare-and-set, including conflict retries. Playback, queue, clock and room-settings events below remain planned, not implemented.

## Implemented Phase 3 protocol

Socket.IO has a 16 KiB message limit, exact Origin checking and cookie session validation. Handshake auth is strictly `{ roomId, csrfToken }`. Membership must already exist through REST; roles are never accepted from the client. Unauthorized connections fail with `AUTH_REQUIRED`; guest identity, membership and CSRF are checked again on reconnect. The server revalidates session expiry for each event.

| Direction       | Event              | Payload / acknowledgment                                                               |
| --------------- | ------------------ | -------------------------------------------------------------------------------------- |
| Client → server | `room:state`       | Callback → `Result<Membership>`; full recovery snapshot                                |
| Client → server | `room:leave`       | `{ requestId: UUID, expectedRevision }` + callback → `Result<null>`; participants only |
| Client → server | `room:close`       | Same command envelope; Host only                                                       |
| Server → client | `room:state`       | Full `RoomState`, including monotonic revision and public participant IDs              |
| Server → client | `room:closed`      | Safe reason text, followed by disconnection                                            |
| Server → client | `session:replaced` | Another socket took over this membership; old socket disconnects                       |

Typed contracts and Zod input validators live in `shared/contracts`. The room ID and actor are bound to the handshake rather than repeated in commands. Presence changes increment revisions. Clients recover a snapshot on every connect, discard older revisions, disable mutation while disconnected and do not enqueue offline commands. Replaced tabs stop reconnecting automatically.

Create/join have persistent-in-session idempotency receipts. Leave/close are terminal operations: successful execution removes membership/room and disconnects the socket, so replay cannot mutate again. UUIDs are validated but terminal acknowledgment receipts are not retained; after an acknowledgment timeout, refresh membership rather than assume success. Stale commands fail with `STALE_REVISION`; the UI fetches current state and requires another deliberate action. No playback, queue or clock events are implemented yet. Officer events are implemented in Phase 4 above.

Synchronous in-memory mutations execute without await points on a single Node process. Horizontal scaling will require shared authority/serialization, not just a Socket.IO adapter.

## Planned contracts

| Direction        | Events                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Client -> server | room:attach, room:leave, room:close, room:settings:update                   |
| Client -> server | participant:remove, officer:promote, officer:demote                         |
| Client -> server | music:play, music:pause, music:resume, music:seek, music:change, music:skip |
| Client -> server | queue:add, queue:remove, queue:reorder                                      |
| Client -> server | playback:ready, sync:request, sync:status                                   |
| Server -> client | room:state, room:closed, participant:joined/left/updated                    |
| Server -> client | queue:updated, playback:prepare, playback:state, sync:response              |

Create/join remain REST operations; do not duplicate their mutation semantics as socket handlers.

Mutation envelope: protocolVersion, commandId, roomId, expectedRevision and validated payload. The server resolves actor and role from the session, never a client role field. Acknowledgments include command ID, success/failure, authoritative revision and a safe error code.

Error codes include FORBIDDEN, STALE_REVISION, ROOM_FULL, OFFICER_LIMIT_REACHED, TRACK_UNAVAILABLE and RATE_LIMITED. Exact schemas are implemented alongside their approved phase.

## Ordering and delivery

Serialize per-room mutations, recheck current authorization at execution, atomically commit, increment revision and broadcast. Deduplicate successful command retries with receipts. Reject stale revisions and refresh snapshots rather than guessing intent. Telemetry and clock probes do not increment room revisions. Reject old playback generations and server epochs.

Socket.IO guarantees ordering but defaults to at-most-once delivery. Transport reconnection is not proof of state recovery. Always have full snapshot recovery; connection-state recovery is only an optimization. Do not accumulate offline playback commands for blind replay.

## Permission matrix

| Operation                             | Host | Officer | Participant |
| ------------------------------------- | ---- | ------- | ----------- |
| Browse / view queue and members       | Yes  | Yes     | Yes         |
| Play / pause / resume / skip / select | Yes  | Yes     | No          |
| Seek                                  | Yes  | No      | No          |
| Add / remove / reorder queue          | Yes  | Yes     | No          |
| Promote / demote / remove participant | Yes  | No      | No          |
| Room settings / close                 | Yes  | No      | No          |
| Local volume / mute / leave           | Yes  | Yes     | Yes         |

Administrator credentials govern global library operations and do not imply any room role. Enforce the three-Officer limit transactionally using slots. Recheck privileges after demotion, including already queued commands.

References: [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [recovery limitations](https://socket.io/docs/v4/connection-state-recovery/).

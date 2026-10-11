# Socket.IO protocol

Phase 1 starts Socket.IO with a 16 KiB message limit and exact Origin checking. It deliberately rejects every application connection with `ROOM_SESSIONS_NOT_AVAILABLE`. This is a foundation, not implemented guest authentication. Shared event types are empty until Phase 3.

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

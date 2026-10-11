# Audio synchronization design

Target architecture for Phase 8. Phase 1 exports clock sample/estimate types only; no playback or synchronization runs.

## Clock model

Use client performance.now and a server monotonic clock with a unique serverEpoch. Four timestamps: t0 client send, t1 server receive, t2 server send, t3 client receive.

- RTT = (t3 - t0) - (t2 - t1)
- Offset = ((t1 - t0) + (t2 - t3)) / 2

Collect 8–12 initial samples, filter high-RTT outliers, estimate from reliable samples and retain uncertainty. Refresh roughly every ten seconds and smooth changes. Network asymmetry remains a source of error. Reconnect/suspension or a new server epoch invalidates stale mappings.

## Authoritative timeline

State includes trackId, immutable assetId, status, anchorPositionSeconds, anchorServerTimeMs, serverEpoch, playbackGeneration, roomRevision and a pendingTransition with its future effect time. Status includes stopped, preparing, playing and paused.

While playing, position = anchorPosition + (estimatedServerNow - anchorServerTime) / 1000, clamped to duration. Before a future transition takes effect, retain the old timeline. Do not continuously persist progress.

## Scheduling

Authorized command -> validate asset -> playback:prepare -> fetch/decode -> readiness -> authoritative future schedule. Initial preparation deadline: eight seconds. Initial scheduling lead: one to three seconds, adapted to measured jitter/RTT. Start when ready devices exist; a slow client joins later. If none are ready, remain preparing or fail visibly rather than claiming playback.

Convert server time to browser monotonic time and AudioContext time. Use getOutputTimestamp where supported, with fallback estimates and uncertainty. Avoid double-counting output latency. Schedule sources with AudioBufferSourceNode.start, not JavaScript timers. Timers update UI and prepare commands, not exact audio onset.

## Decoding and delivery

Audio is fetched via HTTPS/CDN. decodeAudioData requires complete file data, not arbitrary Range chunks. A five-minute stereo 44.1 kHz Float32 buffer uses about 101 MiB before transient allocations. MVP limits songs to five minutes, keeps one decoded track, and forbids speculative next-track full decoding without a memory budget. Decode/network errors produce explicit local status. A media-element fallback must be labeled Reduced precision and is not covered by precision-path targets.

Canonical immutable playback assets reduce decoder/asset variation. HTTP Range remains useful for media-element delivery but is not an incremental decoder. Longer songs/chunked audio processing require a separate architectural decision.

## Correction and lifecycle

Initial tuning thresholds, not measured guarantees: below 20 ms leave unchanged; 20–80 ms use bounded rate correction (initially +/-0.5%); above 80 ms use short fades and a scheduled restart. Track local position by integrating applied playback rate. Rate correction can change pitch. Each resume/seek creates a fresh source; generation checks invalidate old work.

Late joiners schedule the projected position at a future boundary. On reconnect, acquire a snapshot and fresh clock samples. On suspension, stop local scheduling and request a user gesture when required. Return from background rebuilds mapping. Output-device changes invalidate latency assumptions. A disconnected client fades/pauses after a short grace until authoritative recovery.

User activation is required on every device. Foreground operation is the MVP target; screen-lock/background reliability is not guaranteed. Bluetooth and acoustic propagation delay cannot be inferred perfectly from browser clocks. Automatic queue advancement uses the server timeline, not a client's ended event. Gapless playback is not guaranteed.

## Validation target

Proposed same-Wi-Fi, foreground, built-in-speaker target: pairwise acoustic difference p95 <= 50 ms, subject to real-device evidence. Even 50 ms can be audible in a shared room. Socket command success is not acoustic evidence. Record reference impulse tracks, control distances and report p50/p95/max alongside device/browser/output path. Bluetooth results must be reported separately.

References: [decodeAudioData](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData), [output timestamps](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp), [audio activation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

# Security design and current boundaries

Phase 3 is not production-ready. Guest session authentication, Host authorization, CSRF protection and bounded in-memory rate limiting are implemented. Administrator authentication, upload security, deployment hardening and durable persistence remain future phases.

Guest tokens contain 256 random bits and are stored only as SHA-256 digests on the server. Cookies are HttpOnly, SameSite=Strict, 24-hour fixed expiry; production adds Secure and the `__Host-` prefix. CSRF tokens are independent random values; production requires an HTTPS public origin. Strict request schemas reject role injection. Snapshots expose participant UUIDs, never session digests/tokens. Display names render as escaped React text. Anonymous Host identity cannot be recovered without its cookie.

REST mutations require exact Origin and, except initial session bootstrap, cookie-bound CSRF. Socket handshake requires exact Origin; for browser same-origin polling GETs that omit it, both `Sec-Fetch-Site: same-origin` and a matching Referer origin are required instead. Explicit foreign Origin always fails. Handshake and every event validate session/expiry; only active membership is attached. Expired connected participants are evicted. New tabs disconnect old sockets and cannot overwrite their new presence during old-socket cleanup.

Per-minute limits: session bootstrap 240 per direct remote address, room admission 20 per session, room reads/handshakes/socket events each 60 per session. The app deliberately does not trust arbitrary X-Forwarded-For. Proxy clients may share one backend address: configure a trusted ingress/rate limiter before production scale, not blanket `trust proxy`. Local caps: 500 rooms, 5,000 sessions, 10,000 rate buckets, 100 admission receipts per session. Redis demo mode limits rooms to 5 and sessions to 100; rate counters share the same CAS state. This does not replace edge-level abuse protection, and no audit store exists yet.

## Approved Vercel preparation

Vercel configuration fails closed unless Redis mode and a non-default namespace are configured. Production Redis requires TLS. Secrets remain server-side, raw Redis errors are not returned or logged, and storage failures never create a split-brain memory fallback. Redis contains sensitive session digests and CSRF data: restrict account access and never expose its URL to the browser. Docker build context now excludes nested environment files too.

Cross-instance state uses bounded optimistic retries; commands validate current authorization after each reload. Presence cleanup checks the stored socket ID so old connections cannot detach replacements. Adapter broadcasts are reconciled periodically because pub/sub is not durable. Real provider connectivity, deployment routing, free quotas and outage behavior still need live testing. A free-plan deployment is not a production security certification.

## Dependency review: 2026-10-12

Initial npm audit reported five high-severity entries along one **development-only** chain: eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces. The underlying advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), nested glob patterns causing stack exhaustion. At review time the latest braces is 3.0.3 and is still affected; npm proposes downgrading Next lint configuration to 14.2.35, not a compatible fix for this foundation.

Do not run lint over untrusted generated patterns. No user-supplied glob processing is exposed by the application. Keep this advisory visible and recheck upstream before releases; do not claim a clean full dependency audit. Do not use npm audit fix --force or undocumented dependency overrides to hide it.

ESLint 9.39.5 is deprecated/upstream-unsupported. It is temporarily pinned because current eslint-plugin-react, eslint-plugin-import and eslint-plugin-jsx-a11y peers in Next's lint configuration stop at ESLint 9. Upgrade once the supported peer set is available; TypeScript 5.9.3 is selected within the parser's supported range. Exact versions and lockfile make this decision reproducible.

## Planned authentication

Use Argon2id with benchmarked resource cost. Secure CLI bootstrap, no public administrator registration and no hardcoded password. Store only hashes of high-entropy opaque session tokens. Separate host-only HttpOnly/Secure cookies for administrator and guest sessions, server-side validation, expiry, rotation as needed and revocation on logout.

Account/IP login throttling, progressive delay and generic errors prevent enumeration without easy permanent lockout abuse. Room ownership derives from membership, not public code, client role or localStorage. Credential loss may make anonymous ownership unrecoverable.

## Planned request authorization

REST mutation CSRF token and Origin checks. Socket Origin/session/CSRF binding, expiry/revocation checks over long-lived connections, Zod validation, payload/rate bounds and authorization at command execution. Revision and receipt checks stop stale/replayed effects. Strict origin allowlists; never credentialed wildcard CORS. Display names and metadata render as text with appropriate escaping.

Use CSP and reviewed security headers in the actual product phase. Avoid putting secrets in public frontend environment variables. Redact cookies, passwords, signed URLs and session tokens from logs. Database and storage credentials use least privilege.

## Planned upload defenses

Private quarantine, scoped generated keys, size limits, magic-byte and decoder checks, restricted codecs, sanitized/re-encoded artwork and bounded FFmpeg resources. No arbitrary URLs, SVG artwork or shell-interpolated filenames. Validate actual stored bytes before publishing. Apply processing timeouts and orphan cleanup. Signed delivery URLs are not DRM and cannot revoke bytes already downloaded.

## Anonymous-room limitation

Revocation removes an existing membership. A person with an invitation can create another anonymous identity; permanent personal bans are not promised without additional identity or access controls. No automatic Host transfer.

References: [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

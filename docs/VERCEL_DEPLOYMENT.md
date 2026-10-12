# Vercel deployment preparation

Status: configuration and room persistence implementation only. No live deployment or real Redis verification has been completed. This is a small personal demo, not a production-ready synchronized music service. Music, administrator login, Officers and audio synchronization are not implemented.

## Free-plan boundary

Use Vercel Hobby for an eligible personal, non-commercial project and explicitly select **Upstash Redis Free**, not Pay As You Go. Do not enable paid upgrades. Check the current account limits before deployment; free quotas are finite and service availability is not guaranteed. No paid account, database, domain or deployment was created by this work.

The configuration targets Vercel Services Beta and WebSockets Beta. Enable Fluid Compute. A function's maximum duration can close a WebSocket; reconnects may reach another instance. Redis holds shared room/session state and the Socket.IO adapter distributes events. These capabilities and their beta status should be checked in your account before publishing.

## Dashboard setup

1. Create an explicitly Free Upstash Redis database near the intended Vercel region. Obtain its **TLS Redis connection URL** (`rediss://...`), not its REST URL/token. Never paste credentials into chat or source files.
2. Import the repository into one Vercel Hobby project. Keep Root Directory at the repository root and select the **Services** framework preset. Use Node.js 24.x. Keep the root lockfile and workspace packages included.
3. Configure the following server environment values in Vercel before deploying. Apply them to Production only initially. Do not prefix secrets with `NEXT_PUBLIC_`.

| Variable           | Value                                             |
| ------------------ | ------------------------------------------------- |
| `ROOM_STORE`       | `redis`                                           |
| `REDIS_URL`        | Private TLS Redis connection URL                  |
| `REDIS_KEY_PREFIX` | `allplay:production`                              |
| `WEB_ORIGIN`       | Exact public HTTPS origin, without trailing slash |

Vercel supplies `VERCEL=1`; the backend entrypoint forces production behavior. `API_INTERNAL_URL` is not needed for Vercel Services routing. Use the stable project domain for `WEB_ORIGIN`; a different preview/deployment URL will be rejected by Origin checks. For a preview, configure its own exact origin and a distinct Redis key prefix. Never share production state with untrusted previews.

4. Enable Fluid Compute and check that Services/WebSockets Beta are available. The root `vercel.json` routes `/api/*` and `/socket.io/*` to `backend`; everything else goes to `frontend`. Each service builds the shared packages before its own build. The backend exports an HTTP server from `src/vercel.ts`; it does not launch a local port listener.
5. Deploy from the dashboard. If the account does not offer these beta capabilities, stop and review a different free hosting design; do not silently select a paid plan.
6. Complete the verification below before sharing the link widely. Watch both providers' usage dashboards. Health is liveness only and does not prove Redis is working.

## Required live verification

- Open `/api/v1/health`, then create a room in a normal browser and join from an incognito profile.
- Confirm a WebSocket `101` upgrade, presence changes, Host-only close and rejection of foreign origins/invalid CSRF.
- Refresh the Host: identity and room must survive. Open another tab: the newer connection must replace the old one.
- Leave the page open beyond the function duration: transport reconnection must recover the room without duplicating membership.
- Close a room while the browsers are served by different instances and confirm both receive closure.
- Test a redeployment with an existing room. Compatible stored schema and the same prefix must preserve membership. Incompatible schema deployments need a migration or an explicitly announced reset; this implementation has no schema migration tool.
- In a separate test environment, interrupt Redis access and confirm operations fail safely without creating independent memory rooms. Restore access and retry. An instance whose initial Redis connection failed may need recycling; automatic cold-start recovery is not certified.

## Limits and persistence

Cloud mode caps the demo at 5 rooms, 100 retained guest sessions and a 512 KiB serialized state payload. Each room allows 20 devices. Sessions and rooms expire after 24 hours. Disconnected guest reservations last 2 minutes and Host absence closes a room after 10 minutes. Crash detection uses 90-second leases renewed every 30 seconds while sockets are active; grace starts after lease expiry when an instance vanishes.

One Redis hash contains the bounded state snapshot. A Lua compare-and-set serializes concurrent changes; broadcasts happen after commit. This deliberately simple implementation reads/writes the whole snapshot and can consume bandwidth quickly. These caps do not guarantee staying within free quotas. Larger scale requires per-room storage, durable command processing and load testing.

Cleanup runs on operations/active connection refreshes, not a billed cron. The entire state key has a refreshed 26-hour expiry. Socket messages missed during pub/sub outages are reconciled by snapshots within approximately 30 seconds while connected. Redis unavailability returns safe errors; there is no memory fallback. Credential loss, provider data loss or key expiry cannot recover anonymous Host ownership.

The simplified layout is now `frontend/`, `backend/`, and `shared/`. Workspace paths, Docker paths, environment resolution, tests and the Vercel service roots were updated together. Import the repository root, not the frontend subdirectory, for the two-service deployment.

## Optional real Redis test

Use an isolated test Redis database and set `ALLPLAY_TEST_REDIS_URL` securely in a WebStorm run configuration, then run `npm.cmd run test`. The opt-in integration test creates a random namespace, runs two backends, checks cross-instance presence/closure and removes only its exact test state key. It never flushes the database. Without this variable, the test is explicitly skipped. Deterministic coordinator tests use a shared memory store and are not a substitute for this network test.

## References

- [Vercel WebSockets](https://vercel.com/docs/functions/websockets)
- [Vercel Services configuration](https://vercel.com/docs/services/config-reference)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Socket.IO Redis adapter](https://socket.io/docs/v4/redis-adapter/)

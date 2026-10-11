# Location & SOS Socket — Test Spec

READ `AGENTS.md` on project root before implementing.

Source specs: `01-system-technical-specs.md` §5, `03-api-routes.md`, `02-module-implementation-plan.md` Phase 6/7.

## 1. Scope

Tests the `/location` Socket.IO namespace: driver ingest, dashboard fan-out, SOS priority lane, throttle, membership cache, reconnect/backfill. Excludes REST-only routes already covered by existing route specs.

## 2. Test Harness

- `socket.io-client` against a running Nest instance, backed by real Redis and Postgres test containers — throttle/GEO/pub-sub behavior cannot be meaningfully mocked.
- Helper `connectAs(role, overrides)` — issues a real access token through the existing auth service (reuse `JwtStrategy`/login flow), not a hand-rolled token.
- Helper `waitForEvent(socket, eventName, timeoutMs)`.
- `FLUSHDB` on a dedicated Redis test DB between cases — throttle keys and `driver:{id}:orgs` cache leak across tests otherwise.
- Timing-sensitive tests (throttle window, membership-cache invalidation window) run serially; isolation tests may run in parallel with randomized driver/org IDs.

## 3. Connection & Auth

| # | Case | Expected |
|---|---|---|
| 3.1 | Valid access token in `handshake.auth.token` | Connection accepted |
| 3.2 | Valid access token in `Authorization` Bearer header | Connection accepted |
| 3.3 | Missing token | Connection rejected via `connect_error` |
| 3.4 | Expired access token | Connection rejected |
| 3.5 | Blacklisted `jti` (post-logout) at connect time | Connection rejected |
| 3.6 | Token valid at connect, blacklisted mid-session (force logout) | Existing socket is force-disconnected, not just blocked on next connect |
| 3.7 | Driver-role socket calls `dashboard:subscribe` | Rejected — role mismatch |
| 3.8 | Org-manager socket emits `location:ping` | Rejected — role mismatch |

## 4. `location:ping` (driver → server)

| # | Case | Expected |
|---|---|---|
| 4.1 | Well-formed `{ lat, lon, speed, heading, deviceTs }` | `GEOADD fleet:live` and `driver:{id}:meta` both updated |
| 4.2 | Missing/malformed field | Validation error event returned, no Redis write |
| 4.3 | Out-of-range lat/lon | Rejected |
| 4.4 | 10 rapid pings within 1s | All 10 update GEO/meta; only throttle-eligible pings publish |
| 4.5 | `deviceTs` older than currently cached meta's `deviceTs` (offline buffer replay / clock skew) | GEO write proceeds (last-write-wins is intentional per spec §5.6), but must not visually regress the live position on dashboards mid-throttle-window — assert cached meta isn't overwritten with a stale point inside the same throttle cycle |
| 4.6 | `deviceTs` in the future (bad device clock) | Accepted, but must not corrupt detention dwell-timer math |
| 4.7 | Driver with zero active orgs pings | GEO/meta still written (ingestion is unconditional); zero publishes |

## 5. Throttled Fan-out

| # | Case | Expected |
|---|---|---|
| 5.1 | First ping for a driver | Publishes immediately, sets `throttle:driver:{id}` (EX 3) |
| 5.2 | Second ping within throttle window | No publish; GEO/meta still updated |
| 5.3 | Ping arrives after throttle expires | Publishes latest cached position, not the intermediate throttled-away points |
| 5.4 | No further ping arrives after the last throttled write (driver stops moving/pinging) | Confirm whether a background sweep flushes the final cached position, or whether dashboards are left with a stale-but-unpublished point — **see edge case report** |
| 5.5 | Two drivers pinging concurrently | Independent throttle keys, no cross-driver interference |

## 6. `dashboard:subscribe` (org manager → server)

| # | Case | Expected |
|---|---|---|
| 6.1 | Manager subscribes to an org they belong to | Joins `org:{orgId}:locations` room, ack success |
| 6.2 | Manager subscribes to an org they do not belong to | Rejected server-side regardless of client-supplied `organizationId` |
| 6.3 | Subscribed manager receives publish for their org | Delivered within one throttle window |
| 6.4 | Manager subscribed to org A | Does not receive org B's driver events |
| 6.5 | Manager's membership revoked mid-session | Next publish cycle excludes them — assert within one throttle cycle (3s), per tech spec §5.5 |
| 6.6 | Manager subscribes to multiple orgs | Receives events from all subscribed rooms |
| 6.7 | Duplicate `dashboard:subscribe` for the same org | Idempotent, no duplicate delivery |

## 7. `sos:trigger`

| # | Case | Expected |
|---|---|---|
| 7.1 | Driver triggers SOS while `throttle:driver:{id}` is active | Publishes immediately to `org:{orgId}:sos`, unaffected by the location throttle |
| 7.2 | SOS publishes to all active orgs for the driver | Matches membership set, same server-side ACL as location fan-out |
| 7.3 | `IncidentAlert` row is created | Exists even if emergency contact notification later fails |
| 7.4 | Emergency contact fan-out | Notified in `priority` order, best-effort — one failed contact doesn't block the rest |
| 7.5 | Dashboard subscribed to `:locations` but not explicitly to `:sos` | Confirm whether `:sos` room join is implicit on org subscribe — **see edge case report** |
| 7.6 | SOS from a driver with zero active orgs | `IncidentAlert` still created for admin visibility; zero org publishes |

## 8. Reconnect / Backfill

| # | Case | Expected |
|---|---|---|
| 8.1 | Client reconnects with `lastAckedDeviceTs` | Server does not replay buffered live WS events for the gap |
| 8.2 | Client calls REST history endpoint after reconnect | Returns ordered `LocationHistory` rows since `lastAckedDeviceTs` |
| 8.3 | Gap still sitting in the Redis buffer, not yet flushed to Postgres | Confirm backfill source for this window — **see edge case report** |
| 8.4 | Dashboard socket disconnects and reconnects | Must explicitly re-subscribe; Socket.IO room membership does not survive a reconnect |

## 9. Horizontal Scaling / Redis Adapter

| # | Case | Expected |
|---|---|---|
| 9.1 | Driver on gateway instance A, manager subscribed on instance B | Manager still receives fan-out via `socket.io-redis-adapter` |
| 9.2 | Instance A crashes mid-session | Driver client auto-reconnects to any live instance; no server-side session pinning required |

## 10. Detention

| # | Case | Expected |
|---|---|---|
| 10.1 | Driver stationary past `DETENTION_THRESHOLD` | `DetentionAlertJob` enqueued once |
| 10.2 | Driver stationary, already alerted | No duplicate alert on subsequent pings |
| 10.3 | Driver leaves `RADIUS` then returns | Dwell state resets with a new `since` timestamp |

## 11. Execution

```bash
pnpm test:e2e -- location.gateway.e2e-spec.ts
```

Requires local Redis + Postgres test containers per the existing e2e bootstrap in `AGENTS.md`.

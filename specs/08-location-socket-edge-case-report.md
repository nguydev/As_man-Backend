# Location & SOS Socket — Edge Case Report

Derived from `01-system-technical-specs.md` §5, `03-api-routes.md`, and gaps surfaced while writing `06-location-socket-test-spec.md` / `07-location-socket-frontend-plan.md`. Not yet fixed — triage and assign.

Severity: **P0** blocks correctness/safety, **P1** causes bad UX or data quality issues, **P2** worth deciding but not urgent.

---

### P0 — SOS during backed-up throttle/queue state
Spec §5.9 says SOS bypasses the location throttle and has its own BullMQ queue, which is correct. But nothing in the spec defines a **timeout/circuit-breaker on the emergency-contact send step itself** — if the SMS/push provider is slow or down, does `sos:trigger` ack block on it, or does the ack return as soon as the `IncidentAlert` row is committed? If ack waits on contact delivery, a slow provider makes the driver's UI look like SOS failed when it didn't.
**Fix direction:** ack immediately on `IncidentAlert` persistence; contact delivery happens async, independently reported.

### P0 — No documented flush for the last throttled position
Test spec §5.4: if a driver stops pinging right after a throttled (non-published) update, the last known-good position sits in Redis GEO but was never published to dashboards. Nothing sweeps and flushes it. Dashboards can show a driver's second-to-last position indefinitely.
**Fix direction:** either a scheduled sweep job publishing any GEO entry whose throttle key just expired, or accept it and make it explicit that dashboards must reconcile via periodic REST poll of live positions rather than relying purely on WS pushes.

### P0 — `deviceTs` clock skew corrupting detention math
Ingestion accepts client-supplied `deviceTs` with no bounds checking mentioned. A device with a skewed clock (common on low-end Android hardware) could report `deviceTs` values that make the dwell state machine (§5.6) compute nonsensical durations — either never triggering detention or triggering it instantly.
**Fix direction:** clamp `deviceTs` to a sane window around `receivedTs` (e.g. reject or fall back to `receivedTs` if drift exceeds N minutes) before it feeds the dwell calculation specifically — the GEO/history path can keep raw `deviceTs` for audit purposes.

---

### P1 — Dashboard org-switch / unsubscribe undefined
Spec defines `dashboard:subscribe` but no `dashboard:unsubscribe`. A multi-org admin switching orgs in the UI has no documented way to leave a room. Either they accumulate room memberships (receiving events for orgs no longer in view — wasted bandwidth, and a minor data-exposure smell even if UI-filtered) or the intended pattern is "reconnect the socket per org switch" (which is disruptive for the driver-ping side of nothing but fine for dashboard-only sockets).
**Fix direction:** add `dashboard:unsubscribe`, symmetrical with subscribe, server-side room leave.

### P1 — `:sos` room join not explicitly separate from `:locations`
Spec says dashboards are "always subscribed regardless of general location throttle state" to `org:{orgId}:sos`, but the only client-facing subscribe event documented is `dashboard:subscribe` (implied for `:locations`). Unclear if one subscribe call joins both rooms or if a second implicit server-side join happens.
**Fix direction:** document explicitly — recommend single `dashboard:subscribe` joins both `:locations` and `:sos` rooms server-side, since splitting them client-side just adds a call site for no benefit.

### P1 — Backfill source for the small-gap window
Spec §5.8 says reconnect gap-filling reads from `LocationHistory` "or Redis buffer if the gap is small," but doesn't define the boundary or whether the REST history endpoint transparently checks both. If it only reads Postgres, a driver who reconnects within the BullMQ flush interval gets an incomplete backfill for the most recent seconds.
**Fix direction:** either have the history endpoint check the Redis buffer first for recent points, or explicitly document the acceptable gap (equal to the flush interval) as expected/acceptable data loss for backfill purposes — pick one and write it down.

### P1 — Multiple simultaneous connections per driver (same account, two devices)
Nothing in the spec addresses a driver logging into two devices at once (old phone + new phone during a swap, tablet mount + handheld). Both would ping independently. Redis GEO/meta is last-write-wins per driver ID, so positions could visibly jump between two devices' locations.
**Fix direction:** decide product behavior — last-connection-wins (disconnect the older socket on new connect) vs. allow both and accept jitter. Given this is a safety product, recommend disconnecting the prior session on new connect, mirroring the existing `user_sessions:{userId}` force-logout pattern from the auth spec.

### P1 — Driver with zero active orgs pinging/triggering SOS
Confirmed in the test spec that ingestion and `IncidentAlert` creation happen unconditionally, but worth flagging as a product question, not just a technical one: a self-signed-up driver not yet claimed by any organization can still trigger SOS. Is there *any* recipient for that incident besides the driver's own emergency contacts (no org dashboard to see it, and presumably no super-admin default view of orgless incidents)?
**Fix direction:** confirm whether the admin console needs an "unassigned/orphan incidents" view, or whether emergency-contact-only delivery is accepted as sufficient for unaffiliated drivers.

### P1 — Duplicate `dashboard:subscribe` and reconnect race
Test spec covers idempotency of duplicate subscribe calls, but not the race between a client's automatic reconnect-then-resubscribe sequence and a manual org-switch subscribe firing close together. Possible double room-join isn't harmful, but a subscribe arriving on a not-yet-authenticated reconnected socket needs a defined order (auth completes before subscribe is processed, not queued ambiguously).
**Fix direction:** ensure the gateway processes `dashboard:subscribe` only after the connection's auth/room-eligibility check has fully resolved for that reconnect, not just once at initial connect.

---

### P2 — Throttle window is a fixed 3s constant
No mention of it being configurable per plan tier or org. If a premium tier later wants tighter live tracking (e.g. 1s), this is a schema/constant change, not a design flaw — just flag it now since it'll surface as a feature request.

### P2 — No documented rate limit on `location:ping` beyond the throttle
The throttle controls *fan-out*, not *ingestion*. A malfunctioning or malicious client could hammer `location:ping` far above the expected 1-per-3-10s cadence with no server-side ingestion rate limit — cheap per the spec, but "cheap" assumes reasonable client behavior.
**Fix direction:** decide if a coarse per-socket ingestion rate limit (e.g. max 5 events/sec) is worth adding as a defensive measure, separate from the fan-out throttle.

### P2 — SOS acknowledgment format unspecified
Frontend fallback logic (REST vs socket) depends on getting a clear ack/timeout signal from `sos:trigger`. The spec doesn't define the ack payload shape (success/failure, incident ID returned, etc.) — needs to be nailed down before the frontend fallback logic in `07-location-socket-frontend-plan.md` can be implemented correctly.

---

## Suggested Triage Order

1. P0s — block correctness and safety guarantees, fix before any frontend work depends on them.
2. P1 dashboard subscribe/unsubscribe + SOS room semantics — blocks dashboard frontend implementation directly (see open questions in `07-location-socket-frontend-plan.md`).
3. P1 multi-device session handling — product decision needed, not just code.
4. Remaining P1/P2 — schedule after v1 ships, unless product flags orphan-incident visibility as required for launch.

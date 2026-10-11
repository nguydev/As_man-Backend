# Asman Platform — Technical Specification (v1)

Stack: NestJS · PostgreSQL · Prisma · Redis (cache/pub-sub/GEO) · BullMQ · Stripe · WebSockets (Socket.IO w/ Redis adapter)

---

## 1. Domain Model

Source of truth: `prisma/schema/**/*.prisma`.

This spec documents behavior and module boundaries only. Do not duplicate Prisma model definitions here; update the schema files and regenerate Prisma when the domain changes.

**Notes**

- No `orgId` on `Driver` directly — always resolve org/fleet relationships through the membership models in `prisma/schema/business`.
- `Attorney` has no active login flow in v1 — it is admin-managed even if the schema keeps a nullable user relation for a future portal.
- Soft-delete via status enums, not row deletion — location/case history needs the FK intact for audits.

---

## 2. Auth & Permissions

- JWT access + refresh token pair, refresh rotated on use, stored hashed in Redis (`refresh:{userId}:{jti}`) for revocation.
- `role: ADMIN` is reserved for the platform owner and grants full platform access. Delegated administrators keep `role: USER` and receive a `Maintainer` record with the permissions needed for their duties.
- `PermissionsGuard` reads the permission key and minimum level from `@RequirePermission`, permits the active platform owner, and otherwise checks the active user's keyed `Maintainer.permissions` map. Permission caching is optional and must be invalidated by the future grant/revoke flow if introduced.
- Organization-scoped routes use `@OrganizationRoles()` and `OrganizationRolesGuard` against the active `OrganizationMember.role`; maintainer permissions do not grant organization membership access.

---

## 3. Signup Flows

| Path                                  | Fields                                         | Who can call it    |
| ------------------------------------- | ---------------------------------------------- | ------------------ |
| Driver self-signup                    | name, email, password, vinNumber, licensePlate | Public endpoint    |
| Driver added by organization owner    | name, email, password, vinNumber, licensePlate | Owner dashboard    |
| Driver added by Admin                 | same fields                                    | Admin dashboard    |
| Organization added by Admin           | name, email, password (or invite)              | Admin dashboard    |

Two creation modes need to converge on one service (`DriverService.createDriver`) regardless of caller, differentiated only by an `actorContext` param (`{ actorId, actorRole }`) used purely for audit logging and initial membership creation. Provider/Admin-created drivers get a membership row immediately; self-signup drivers don't, until claimed by an organization.

Managed drivers are created directly with an email/password credential. Admin-created drivers may be attached to an organization immediately; owner-created drivers are attached to their organization immediately.

---

## 4. Subscriptions & Stripe

### Rules recap

- Plans editable by admin.
- Once a plan has an active subscriber, edits create a new `Plan` row; old one is `DEPRECATED`, view-only.
- Driver-count limits enforced per tier.

### Edit-plan flow

1. Admin edits Plan X.
2. Service checks `Subscription.count({ planId: X.id, status: ACTIVE })`.
3. If `0` → mutate in place.
4. If `> 0` → clone row with new fields, set `supersedesId = X.id`, mark X `DEPRECATED`. New subscriptions from this point reference the clone; existing ones keep pointing at X (now deprecated but intact for detail views/invoices).

### Webhook pipeline

- Endpoint verifies Stripe signature synchronously, then pushes raw event to `BullMQ('stripe-events')` immediately (don't process inline — Stripe times out at 10s and retries on non-2xx, causing duplicate delivery).
- Idempotency: `ProcessedStripeEvent(stripeEventId unique)` — worker checks/inserts this row in the same transaction as the event's side effects; if insert fails (unique violation), event already handled, ack and skip.
- Events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

### Driver-limit enforcement

Enforced at the point of organization/fleet membership creation (covers Stripe-driven and dashboard-driven paths identically):

```
async addDriverToOrg(organizationId, driverId, fleetId?) {
  const activeCount = await membershipRepo.countActive(organizationId);
  const sub = await subService.getActiveSubscription(organizationId);
  if (activeCount >= sub.plan.driverLimit) {
    throw new DriverLimitExceededException();
  }
  return membershipRepo.create({ organizationId, driverId, fleetId });
}
```

Do this check inside a DB transaction with `SELECT ... FOR UPDATE` on the organization's subscription row, or use a Postgres advisory lock keyed on `organizationId` — two concurrent add-driver requests racing past a count check is the classic bug here.

---

## 5. Real-Time Location System

This is the highest-risk subsystem. Full design below.

### 5.1 Problem shape

- One driver can belong to multiple organizations through membership records.
- Multiple orgs' dashboards need the same driver's live position, but **only** while membership is `ACTIVE`.
- Ping volume: N drivers × 1 ping/3–10s. Naively broadcasting every raw ping to every subscribed dashboard does not scale and leaks data if ACL is enforced client-side.

### 5.2 Ingestion (driver → server)

- Driver app holds a persistent Socket.IO connection, authenticated via JWT on handshake.
- Every GPS tick emits `location:ping` with `{ lat, lon, speed, heading, deviceTs }`.
- Server writes immediately to Redis GEO: `GEOADD fleet:live lon lat driverId`, plus a hash `driver:{id}:meta` (speed, heading, deviceTs, receivedTs).
- This hot-path write is the only thing that happens synchronously on every ping. Nothing else runs inline.

### 5.3 Fan-out (server → dashboards)

- Server-side ACL, never client-side filtering:

```
On ping from driver D (throttled, see 5.4):
  orgIds = await getActiveOrgIds(D)   // Redis-cached set, see 5.5
  for (orgId of orgIds):
    redisPub.publish(`org:${orgId}:locations`, JSON.stringify(payload))
```

- Dashboard clients subscribe (via their gateway instance) only to `org:{orgId}:locations` channels for orgs they're authorized on — verified at socket-room-join time against the requester's own role/org, not trusted from client input.
- A dashboard socket never receives a driver-keyed channel directly. This means an org losing access to a driver mid-trip stops receiving events the moment `getActiveOrgIds` reflects the removal — no reliance on the client to unsubscribe correctly.

### 5.4 Throttling: decouple ingest rate from broadcast rate

- Ingest (Redis GEO write) happens at whatever frequency the device sends — cheap.
- Broadcast to dashboards is throttled per-driver (e.g. max 1 emit per 3s), independent of ingest frequency. Implement with a Redis key `throttle:driver:{id}` (SET NX EX 3) — if the throttle key exists, update Redis GEO but skip the publish step; a background sweep (or the next ping past the TTL) emits the latest cached position.
- This is the single highest-leverage change for gateway stability at fleet scale — do not skip it.

### 5.5 Membership cache (hot lookup, not a DB hit per ping)

- `driver:{id}:orgs` → Redis SET of active orgIds.
- Populated on driver login / membership change, TTL refreshed on read (sliding), hard-invalidated (`SREM`/full delete) on membership status change — the invalidation call lives directly inside `removeDriverFromOrg()`/`addDriverToOrg()`, not a background job, so there's no window where a removed org keeps receiving a stream.
- Unit test explicitly for: "membership set to REMOVED while driver mid-trip → next ping fan-out excludes that org within one throttle cycle."

### 5.6 Cold path (history + audit)

- BullMQ worker batches pings from a Redis list/stream (`location:buffer:{driverId}`) and flushes to a `LocationHistory` Postgres table every N seconds or M pings, whichever first.
- `LocationHistory` rows carry `deviceTs` (client-generated) as the sort key for trip reconstruction — `receivedTs` (server) is only used for the live GEO position, where last-write-wins is fine.
- Detention/dwell calculation runs off a Redis state machine per driver (`driver:{id}:dwell = { lat, lon, since }`), not by re-scanning history on every ping:

```
On ping:
  if distance(ping, dwell.location) < RADIUS:
    if now - dwell.since > DETENTION_THRESHOLD and not alreadyAlerted:
      enqueue DetentionAlertJob
  else:
    dwell = { location: ping, since: now }
```

### 5.7 Horizontal scaling

- Multiple NestJS gateway instances behind ALB, `socket.io-redis-adapter` for cross-instance room broadcast (same pattern as Koko's chat scaling — reuse directly).
- Sticky sessions at ALB not required since fan-out goes through Redis pub/sub, not in-process memory.

### 5.8 Reconnect / gap handling

- Client sends `lastAckedDeviceTs` on reconnect handshake.
- Server does not replay buffered live events for the gap — instead responds with a small REST/RPC backfill call reading from `LocationHistory` (or Redis buffer if the gap is small) so out-of-order WS delivery never corrupts trip reconstruction.

### 5.9 SOS — separate priority lane, not on the throttled channel

- SOS is a distinct event (`sos:trigger`), bypasses `throttle:driver:{id}` entirely, publishes to `org:{orgId}:sos` (separate channel, dashboards always subscribed regardless of general location throttle state) and triggers:
  - immediate push notification fan-out to the driver's `EmergencyContact` list (priority-ordered)
  - a `Case`-adjacent `IncidentAlert` row for admin visibility
- Never let SOS delivery depend on the same queue depth as routine location pings — separate BullMQ queue (`sos-alerts`) with its own concurrency, so a backed-up location-flush queue can't delay an SOS.

---

## 6. Attorney & Case Management

- Attorneys are standalone records with no login account. Admin CRUD only.
- Case creation: admin selects driver (optional — some cases may not be driver-linked yet) + attorney, sets status.
- Status transitions (`OPEN → IN_PROGRESS → CLOSED/ARCHIVED`) are admin-only, logged in an append-only `CaseStatusHistory` table for audit (attorneys/drivers have no write access to status in v1).
- Vault documents can be linked to a case (`VaultDocument.linkedCaseId`) for the admin-mediated case view.

---

## 7. Module Boundaries (NestJS)

```
src/
  auth/                 // JWT strategy, guards, permission decorator
  users/                // User, Maintainer, permission grants
  drivers/               // Driver CRUD, vault, contacts
  organizations/          // Organization CRUD
  memberships/            // Organization/fleet membership logic + limit enforcement
  attorneys/              // Attorney CRUD
  cases/                  // Case CRUD + status history
  subscriptions/          // Plan, Subscription, Stripe webhook handling
  location/
    gateway/              // WS gateway (ingest + dashboard subscription)
    ingestion.service.ts  // Redis GEO write, throttle logic
    fanout.service.ts     // pub/sub to org channels
    history.worker.ts     // BullMQ cold-path flush
    detention.service.ts  // dwell state machine + alert trigger
  sos/                    // SOS event handling, contact fan-out, IncidentAlert
  vault/                  // S3 presigned upload/download for driver docs
```

---

## 8. Confirmed V1 Decisions

1. Attorneys are admin-managed records with no v1 login.
2. Fleet assignment is optional; organization-only driver membership is valid.
3. Driver limits are enforced per organization.
4. Location dashboard fan-out is throttled to one publish per driver every 3 seconds.
5. Vault metadata remains until an authorized explicit deletion; storage lifecycle policy owns byte retention.
6. SOS contact delivery is best-effort, while incident persistence is mandatory.

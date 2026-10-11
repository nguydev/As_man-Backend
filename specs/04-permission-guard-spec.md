# JWT Auth & Permission Guard — Technical Spec

**Stack:** NestJS · PostgreSQL (Prisma) · Redis
**Status:** reflects actual implementation

---

## 1. Overview

Auth system with two layers:

1. **JWT Guard** — verifies identity (JWT access token, opaque refresh token, Redis-backed revocation).
2. **Permission Guard** — enforces authorization using a two-model system: `User.role` for coarse admin/user distinction, `Maintainer.permissions` for fine-grained per-user permission levels, cached in Redis per user.

Design goals:
- Fast hot path (Redis authorization/blacklist checks, no database hit while cached).
- Instant revocation capability (logout, ban, role change) without waiting for token expiry.
- Fine-grained, level-based permissions per subject (`system.driver: WRITE`) without a join-table.
- Minimal JWT payload — no stale/sensitive data embedded.

---

## 2. Token Design

### 2.1 Access Token
- Lifetime: 15 minutes
- Signed with `JWT_ACCESS_SECRET`
- Stateless verification (no DB/Redis hit on normal path)

**Payload:**
```json
{
  "sub": "userId",
  "role": "ADMIN",
  "jti": "uuid",
  "tokenType": "access",
  "iat": 0,
  "exp": 0
}
```

- `jti` — unique token id, used for single-token blacklist (logout).
- **No email, permissions, or PII in payload.** Payload is base64, not encrypted.

### 2.2 Refresh Token
- Lifetime: 30 days
- Opaque random UUID (not a JWT) stored in Redis
- One-time use — rotated on every refresh call
- The SHA-256 hash is stored in PostgreSQL for the session audit trail and used in the Redis key; the raw token is never stored.
- Reuse of an already-rotated (deleted) refresh token = signal of theft → revoke all sessions for that user.

**Redis key:** `rt:{sha256(refreshToken)}` → `{ userId, jti }`, TTL 30d

---

## 3. Redis Key Namespace

| Key pattern | Purpose | TTL |
|---|---|---|
| `bl:{jti}` | Blacklisted access token (logout / force revoke) | remaining access token life |
| `rt:{sha256(refreshToken)}` | Active refresh token → `{userId, jti}` | 30d |
| `user_sessions:{userId}` | SET of active `jti`s for a user (enables force-logout-all without SCAN) | rolling |
| `authorization:{userId}` | Cached authorization snapshot (status, role, permission levels) | 60s |

---

## 4. JWT Strategy & Guard

### 4.1 Verification flow
1. Extract Bearer token.
2. Verify signature + expiry (passport-jwt).
3. Check `bl:{jti}` in Redis — if present, reject (`401`).
4. Load `authorization:{userId}` and reject inactive/deleted users or a stale role (`401`).
5. Attach the JWT payload and resolved authorization snapshot to `req.user`.

### 4.2 Guard behavior
- Registered globally (`APP_GUARD`), **deny by default**.
- Public routes opt out via `@Public()` decorator — safer than opting in per protected route.

### 4.3 Full user data
- JWT carries only `userId` + `role`. Anything else (email, profile, subscription status) is fetched from DB/cache **on demand**, not embedded in token — avoids staleness and payload bloat.

---

## 5. Refresh & Logout Flows

### 5.1 Issue tokens (login)
1. Generate `jti`, sign access token (15min).
2. Generate refresh token (UUID), store `rt:{sha256(token)}` in Redis (30d TTL).
3. Add `jti` to `user_sessions:{userId}` SET.

### 5.2 Refresh
1. Atomically consume `rt:{sha256(oldToken)}` with Redis `GETDEL`.
2. If missing, consult the PostgreSQL session audit row. A known token is reuse and revokes all sessions; an unknown token returns `401`.
3. Mark the old PostgreSQL session row revoked.
4. Issue new access + refresh token pair.
5. **Reuse detection:** if a client sends an already-deleted refresh token, treat as compromised — revoke all sessions (`user_sessions:{userId}` → blacklist every `jti`, clear refresh tokens for that user).

### 5.3 Logout (single session)
1. Blacklist current `jti`: `SET bl:{jti} 1 EX <remaining ttl>`.
2. Delete associated refresh token from Redis.
3. Remove `jti` from `user_sessions:{userId}`.

### 5.4 Force logout (all sessions — ban, password change, role change)
1. Iterate `user_sessions:{userId}` → blacklist each tracked `jti` for the access-token lifetime.
2. Revoke active PostgreSQL session rows and delete their Redis refresh keys.
3. Clear the user session SET.
4. Delete `authorization:{userId}` from Redis (see Section 6.4).

---

## 6. Authorization System (Role + Level-based Permissions)

### 6.1 Data model (Prisma)

Two models handle authorization, not a role→permission join table:

```prisma
enum Role {
  ADMIN // platform owner, full access, bypasses permission checks
  USER  // normal user or delegated maintainer
}

model User {
  id           String     @id @default(uuid())
  role         Role       @default(USER)
  status       UserStatus @default(ACTIVE)
  isDeleted    Boolean    @default(false)
  maintainer   Maintainer?
}

model Maintainer {
  id          String @id @default(uuid())
  userId      String @unique
  user        User   @relation(fields: [userId], references: [id])
  permissions Json   @default("{}") // { "system.driver": 2, "system.case": 3, ... }
}
```

**Permission levels** (stored as integers in the `permissions` JSON):

| Level | Meaning |
|---|---|
| `0` | NONE |
| `1` | READ |
| `2` | WRITE |
| `3` | ALL |

**Example `Maintainer.permissions` value:**
```json
{
  "system.user": 1,
  "system.driver": 2,
  "system.case": 3
}
```

Subject keys are dot-namespaced strings (`system.user`, `system.driver`, `system.case`) — free-form, no separate `Permission` table to maintain. Adding a new subject is just a new key in the JSON; no migration.

### 6.2 Permission Guard

**Decorator:**
```typescript
@RequirePermission('system.driver', PermissionLevel.WRITE)
```

**Resolution flow:**
1. Load the user, verify `status === ACTIVE` and `isDeleted === false`. Fail closed (`403`) otherwise.
2. If `user.role === ADMIN` -> permit automatically, skip permission lookup entirely.
3. Otherwise, load `Maintainer.permissions` JSON for the user.
4. Compare the stored level for the route's subject against the required `@RequirePermission()` level: `storedLevel >= requiredLevel`.
5. Deny (`403`) if the subject key is missing (implicit `NONE`) or below the required level.

### 6.3 Caching — per user, not per role

Unlike role-shared permission sets, `Maintainer.permissions` is a **per-user** record, so caching is keyed by `userId`:

**`authorization:{userId}`** — 60s TTL, holds the resolved authorization snapshot:
```json
{
  "role": "USER",
  "status": "ACTIVE",
  "isDeleted": false,
  "permissions": { "system.user": 1, "system.driver": 2, "system.case": 3 }
}
```

On each request: check `authorization:{userId}` in Redis first; on miss, load `User` + `Maintainer.permissions` from Postgres in one query (join), cache the snapshot, then evaluate.

### 6.4 Cache invalidation

`DEL authorization:{userId}` immediately whenever any of the following change:
- `User.role`
- `User.status`
- `User.isDeleted`
- `Maintainer.permissions`

This is a single targeted delete — no fan-out, since the cache is already scoped to one user.

---

## 7. Guard Stack (usage pattern)

```typescript
@UseGuards(PermissionsGuard)
@RequirePermission('system.driver', PermissionLevel.WRITE)
@Patch(':id')
updateDriver(@Param('id') id: string, @Body() dto: UpdateDriverDto) {}
```

- `JwtAuthGuard` is registered globally and runs first unless the route has `@Public()`.
- `PermissionsGuard` uses the authorization snapshot already attached to `req.user`, applies the ADMIN bypass, and performs the level comparison.
- Order matters; NestJS applies guards left-to-right.

---

## 8. Session/Auth Response Shape

`GET /auth/me` returns resolved permissions so frontend can conditionally render UI (guard is still the actual enforcement point — this is UX only):

```json
{
  "userId": "clx...",
  "role": "USER",
  "permissions": {
    "system.user": 1,
    "system.driver": 2,
    "system.case": 3
  }
}
```

Frontend compares levels directly (e.g. `permissions['system.driver'] >= 2` to show a write action) rather than checking string membership.

---

## 9. Non-Goals / Deferred

- Role-to-permission-bundle model (multiple named roles sharing a permission set) — not used; permissions are per-user via `Maintainer`, with `ADMIN`/`USER` only distinguishing bypass vs. checked.
- Field-level / conditional permissions (e.g. "attorney can only read cases assigned to them") — out of scope for v1.
- WebSocket guard variant — separate spec, reuses `JwtStrategy` verification logic manually in handshake middleware.
- Multi-tenant permission scoping (org-level overrides) — not covered here.

---

## 10. Open Questions

- [ ] TTL tuning for `authorization:{userId}` cache — 60s is the current value; writes must invalidate this key immediately.
- [ ] Do we need per-device session tracking (multiple `user_sessions` entries tagged by device/UA) for the admin dashboard's "active sessions" view?

Missing subject keys are treated as `NONE` implicitly.

# Asman Platform - Module Implementation Plan

Source specs:

- `specs/00-system-design.md`
- `specs/01-system-technical-specs.md`
- `prisma/schema/**/*.prisma`

Status: phased implementation plan. The split Prisma schema is the domain-model source of truth. When older prose uses provider or driver-organization membership terminology, map it to `Organization`, `OrganizationMember`, and `FleetMember` instead of adding compatibility models.

---

## 1. Current Repo Baseline

- NestJS 11 app with global `/api/v1` URI versioning.
- Swagger is configured in `src/configs/swagger.config.ts`.
- Prisma 7 client is generated under `prisma/generated/prisma` and re-exported through `@prisma-client`.
- Existing core modules:
  - `src/core/auth`
  - `src/core/files`
  - `src/core/fcm-token`
  - `src/core/health`
- Existing infrastructure modules:
  - Redis
  - BullMQ queue
  - Resend mailer
  - SMS
  - S3 storage
  - observability
- New business features must go under `src/modules/<feature>`.

---

## 2. Build Principles

- Keep controllers thin: DTO in, one service call, documented response out.
- Put Prisma access only in repositories.
- Read validated configuration with `ConfigService<Config, true>` and `get(key, { infer: true })` so nested configuration remains type-safe.
- Use Prisma transactions in coordinator services for multi-write flows.
- Add Swagger decorators to every controller and DTO.
- Keep implementation verification contracts in this specification; the repository instructions currently prohibit generated code test files.
- Keep user-facing strings in `src/locals/*.json`.
- Do not hand-write migrations. Use Prisma CLI after the schema is updated.

---

## 3. Phase 0 - Prisma Domain Schema (Complete)

The domain schema already exists under `prisma/schema/core`, `prisma/schema/common`, and `prisma/schema/business`.

Current schema decisions:

- Auth uses `User`, `Credential`, `Session`, `TwoFactorMethod`, and `TwoFactorBackupCode`.
- `Role.ADMIN` is reserved for the platform owner. Delegated administrators remain `Role.USER`, with keyed access levels stored on `Maintainer.permissions` as JSON; there is no separate permission model or Prisma permission enum.
- Organizations are represented by `Organization`. A provider is an `OrganizationMember` with role `PROVIDER`, not a separate model.
- Organization assignment uses `OrganizationMember`; optional fleet assignment uses `FleetMember` linked to that organization membership.
- Drivers use `Driver` and `DriverStatus`.
- Attorney, case, subscription, location, incident, vault, and file metadata models are already present.

Checks before moving on:

- Existing auth repositories still match generated Prisma types.
- `pnpm prisma generate` succeeds.
- Migration is generated through the Prisma CLI.
- `pnpm build` succeeds.

Known specification differences:

- Permission keys and levels are application-level constants because the schema stores a JSON map.
- Attorneys are standalone records and do not create user credentials.
- `IncidentAlert` is already defined; SOS implementation must use its current fields and enums.

---

## 4. Phase 1 - Permissions Foundation

Module location: extend `src/core/auth` and add `src/modules/maintainers` only if maintainer CRUD is needed now.

Deliverables:

- `@RequirePermission()` decorator.
- `PermissionsGuard`.
- Permission-protected routes apply `JwtAuthGuard` before `PermissionsGuard`.
- The active platform owner (`Role.ADMIN`) bypasses individual permission checks.
- A Maintainer repository method that reads `Maintainer.permissions` for an active, non-deleted delegated administrator (`Role.USER`).
- Query permissions only on routes carrying permission metadata; do not add a database read to every JWT validation.
- Use application permission key and level constants compatible with the current JSON column.

Specs/tests:

- Guard allows a maintainer with the required permission.
- Guard rejects delegated users missing the required maintainer permission.
- Routes without permission metadata remain unaffected.

Notes:

- Do not create a broad RBAC framework, permission cache, maintainer CRUD module, or grant/revoke endpoints in this phase.
- Add cache invalidation with the future grant/revoke flow if permission reads are later cached.

---

## 5. Phase 2 - Organizations, Drivers, Memberships (Implemented)

Modules:

- `src/modules/organizations`
- `src/modules/drivers`
- `src/modules/memberships`

Organization module:

- Admin creates organizations and their initial owner/provider membership.
- Organization members read the organization profiles allowed by active memberships.
- Repository owns `Organization` queries.

Driver module:

- Driver self-signup flow should reuse auth registration where possible.
- Admin/organization-provider create-driver flows converge in one `CreateDriverService`.
- Newly created managed-driver accounts require a password at creation; existing accounts are rejected.
- Driver profile CRUD uses `DriverRepository`.
- Soft delete by `DriverStatus.DELETED`.

Membership module:

- Owns `OrganizationMember` creation/removal and optional `FleetMember` assignment.
- Enforces subscription driver limits at membership creation.
- Invalidates driver active-org Redis cache on add/remove.

Specs/tests:

- Driver self-signup creates a user and driver without membership.
- Organization-owner-created driver creates a `DRIVER` organization membership.
- Admin-created driver can create an organization membership when `organizationId` is supplied.
- Removed membership is excluded from active membership queries.
- Concurrent membership creation cannot exceed plan limit.

Swagger:

- Separate DTOs for public driver signup, admin driver create, and provider driver create.
- Document auth and permission requirements on every route.

---

## 6. Phase 3 - Plans, Subscriptions, Stripe (Implemented)

Module:

- `src/modules/subscriptions`

Deliverables:

- Plan CRUD for admins.
- Plan edit semantics:
  - no active subscribers: update in place
  - active subscribers: clone new row and deprecate old row
- Subscription read/update repository.
- Stripe webhook controller that verifies signature and enqueues raw events.
- BullMQ processor for Stripe events.
- `ProcessedStripeEvent` idempotency.

Specs/tests:

- Editing an unused plan updates the same row.
- Editing a subscribed plan clones and deprecates.
- Duplicate Stripe event is acknowledged without side effects.
- Driver limit service returns the active organization plan limit.

Notes:

- Keep Stripe work out of controllers except signature verification and enqueue.

---

## 7. Phase 4 - Attorneys and Cases (Implemented)

Modules:

- `src/modules/attorneys`
- `src/modules/cases`

Attorney module:

- Admin CRUD only.
- No attorney auth in v1.
- Repository owns `Attorney` queries.

Case module:

- Admin creates cases and assigns attorney.
- Case can optionally link to driver.
- Status transitions write `CaseStatusHistory`.
- Case reads include attorney, driver summary, and linked vault docs.

Specs/tests:

- Case can be created without a driver.
- Invalid status transition is rejected if transition rules are introduced.
- Status update writes history in the same transaction.
- Attorney CRUD does not create user credentials.

Swagger:

- Document that attorneys are admin-managed records without login accounts.

---

## 8. Phase 5 - Vault Documents (Implemented)

Module:

- extend `src/core/files` if it already owns presigned file behavior, otherwise create `src/modules/vault`

Deliverables:

- Driver document metadata CRUD.
- Presigned upload URL for vault documents.
- Presigned download URL for authorized readers.
- Optional case link through `linkedCaseId`.

Specs/tests:

- Driver can create an upload URL only for own vault doc.
- Active organization owners/providers and admins can list and download an assigned driver's vault documents.
- Admin can link a vault document to a case.
- Provider cannot read documents for a driver outside active membership.

Notes:

- Do not stream binary uploads through NestJS.

---

## 9. Phase 6 - Location (Implemented)

Module:

- `src/modules/location`

Suggested structure:

```text
src/modules/location/
  location.module.ts
  gateways/location.gateway.ts
  services/location-ingestion.service.ts
  services/location-fanout.service.ts
  services/location-history.service.ts
  services/detention.service.ts
  processors/location-history.processor.ts
  repositories/location-history.repository.ts
  dto/
  types/
```

Deliverables:

- JWT-authenticated Socket.IO gateway for driver pings.
- Redis GEO write on every ping.
- Per-driver Redis throttle for dashboard fan-out.
- Active organization cache at `driver:{id}:orgs`, resolved through active `OrganizationMember` records with a driver link.
- BullMQ cold-path history flush.
- Detention alert trigger.

Specs/tests:

- Ping writes live Redis GEO/meta even when fan-out is throttled.
- Fan-out publishes only to active org channels.
- Removing membership excludes that org by the next throttle cycle.
- History processor persists buffered pings with `deviceTs` ordering.

Notes:

- Keep ingestion hot path minimal. No database reads per ping.

---

## 10. Phase 7 - SOS (Implemented)

Module:

- `src/modules/sos`

Deliverables:

- Driver `sos:trigger` gateway event or HTTP fallback endpoint.
- Separate Redis/BullMQ lane from routine location pings.
- Publish to `org:{orgId}:sos`.
- Send priority-ordered emergency contact messages.
- Create `IncidentAlert` row for admin visibility.

Specs/tests:

- SOS bypasses location throttle.
- SOS is published only to active orgs.
- Emergency contacts are sorted by priority.
- Incident alert is created even if one contact notification fails, if product accepts partial delivery.

Decision: contact delivery is best-effort; incident persistence must succeed before notifications are queued.

---

## 11. App Module Import Order

Keep infrastructure/core imports before business modules:

```ts
PrismaModule,
RedisModule,
QueueModule,
MailerModule,
SmsModule,
StorageModule,
AuthModule,
FcmTokenModule,
FilesModule,
OrganizationsModule,
DriversModule,
MembershipsModule,
SubscriptionsModule,
AttorneysModule,
CasesModule,
LocationModule,
SosModule,
HealthModule,
```

Only import modules that exist in the current phase. Do not add empty modules for later phases.

---

## 12. Refactor Triggers

Refactor only when one of these becomes true:

- A service crosses one clear use-case boundary.
- A controller starts doing business logic.
- Two modules need the same Prisma query and duplicate repository methods.
- A module import cycle appears.
- Swagger DTOs drift from service input types.
- Prisma schema no longer matches the technical spec.

---

## 13. Immediate Next Step

Implement Phase 1 permissions against the existing `Maintainer.permissions` field, then run:

```bash
pnpm test -- --runInBand
pnpm build
```

# Asman API Route Specification

This document records the implemented v1 transport contract. HTTP routes use the global `/api/v1` prefix and are described by the generated Swagger document.

## Access Model

- Public routes cover authentication, driver signup, health, public file access, and Stripe webhooks.
- Platform routes require the platform owner or a delegated `Role.USER` maintainer carrying `SYSTEM_ADMIN`.
- Organization routes require both an active organization and an active `OrganizationMember` with management access.
- Driver routes resolve the authenticated user's `Driver` record.

## Business Routes

### Organizations and Drivers

- `POST /organizations`, `GET /organizations`, `PATCH /organizations/:id/status`
- `POST /drivers/signup`, `POST /drivers`, `GET /drivers/me`, `PATCH /drivers/me`, `DELETE /drivers/me`
- `POST /organizations/:organizationId/drivers`
- `POST /organizations/:organizationId/members/drivers`, `DELETE /organizations/:organizationId/members/:membershipId`

### Plans and Subscriptions

- `GET /subscriptions/plans`
- `POST /subscriptions/plans`, `PATCH /subscriptions/plans/:id`, `DELETE /subscriptions/plans/:id`
- `GET /subscriptions/organizations/:organizationId`
- `POST /subscriptions/stripe/webhook`

### Attorneys, Cases, and Vault

- `POST /attorneys`, `POST /attorneys/import`, `GET /attorneys`, `GET /attorneys/:id`, `PATCH /attorneys/:id`, `DELETE /attorneys/:id`
- `POST /cases`, `GET /cases`, `GET /cases/:id`, `PATCH /cases/:id/status`
- `POST /vault`, `GET /vault`, `POST /vault/organizations/:organizationId/documents`, `GET /vault/organizations/:organizationId/documents`, `DELETE /vault/organizations/:organizationId/documents/:id`, `GET /vault/organizations/:organizationId/drivers/:driverId`, `GET /vault/organizations/:organizationId/documents/:id/download-url`, `GET /vault/:id/download-url`, `DELETE /vault/:id`, `PATCH /vault/:id/case`

Vault file bytes use the existing file presign and confirmation routes. NestJS stores only file and vault metadata.

### Location and SOS

- `GET /organizations/:organizationId/location/drivers/:driverId/history?since=<ISO-8601>`
- `POST /sos/trigger`
- `POST /sos/contacts`, `GET /sos/contacts`, `PATCH /sos/contacts/:id`, `DELETE /sos/contacts/:id`

Socket.IO namespace `/location` accepts an access token through `handshake.auth.token` or a Bearer header. Events are:

- `location:ping` from an authenticated driver.
- `dashboard:subscribe` with an `organizationId` from an authorized organization manager.

Live location and SOS room fanout use the shared Socket.IO Redis adapter. Location throttles, membership-cache versions, detention locks, history buffers, and BullMQ queues are also shared through Redis, so horizontally scaled instances do not rely on process-local state.

### Templates

Admin markdown content templates and template email send (`system.template` permission; platform `ADMIN` allowed):

- `POST /templates`, `GET /templates`, `GET /templates/:id`, `PATCH /templates/:id`, `DELETE /templates/:id`
- `POST /templates/send` — send template email to a user or organization contact email
- `GET /templates/sends`, `GET /templates/sends/:id` — send history

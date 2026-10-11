## Initialization
Read and follow - `AGENTS.md`

## Overview

Notifications for inidividual users & Admins. we will try to setup an universal notification system that will behave like a notificaiton system, and an email sending system.

### 1. Core Architecture

The system is built on NestJS and uses a combination of Prisma (for
database persistence) and BullMQ (for asynchronous background job
processing via Redis).

### 3. Background Delivery ( NotificationProcessor )
• Once saved, a job is pushed to the BullMQ queue ( QUEUE_NAMES.
NOTIFICATION ).
• The NotificationProcessor consumes these jobs asynchronously.
• It verifies that the notification hasn't expired or already been
delivered.
• Push Notifications: If push is an allowed channel, it fetches the
user's active devices/push tokens from the database. It connects to
Firebase Cloud Messaging (FCM) via FirebaseService to dispatch the push
notification.
• Token Cleanup: If FCM responds that a push token is permanently invalid,
the processor automatically invalidates that token in the database.
• Once successfully delivered, the notification is marked as isDelivered:
true in the database.

### 4. Delivery Channels
The system natively handles multiple channels defined via a
DeliveryChannel enum:

• in_app : Saved in the database and likely queried by the frontend to
show an in-app inbox.
• push : Dispatched to mobile devices via Firebase.
• email : email delivery is
supported as well.


### Privacy

User targeted notifications are for users only but when it comes to Admins/Maintainers, audience will be SYSTEM and we send notifcations to all Maintainers and admins who have access to the system.

### 5. Domain invokes (`NotificationService.notify*`)

Internal helpers (errors are logged, primary flows are not failed):

- `notifyUser(userId, payload)`
- `notifyOrganization(organizationId, payload)` — OWNER/PROVIDER members of active orgs
- `notifySystem(payload)` — ADMIN + maintainers

Default channels: `in_app` + `push`.

| Event | Audience |
|---|---|
| SOS triggered | SYSTEM + each active org for the driver |
| SOS acknowledged / resolved | USER (driver who triggered) |
| Detention alert | SYSTEM + each active org for the driver |
| Organization created (pending) | SYSTEM |
| Organization status ACTIVE | ORGANIZATION |
| Organization REJECTED / SUSPENDED / PENDING | USER (owners) |
| Case created / status changed | USER (linked driver) |
| User status changed | USER (before revoke) |
| Driver membership added / removed | USER (driver) |

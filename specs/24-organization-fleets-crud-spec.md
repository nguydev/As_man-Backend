# Organization Fleets CRUD

**Status:** Implemented  
**Base path:** `/api/v1/organizations/:organizationId/fleets`  
**Access:** Organization `OWNER` or `PROVIDER`

## Why

Prisma already had `Fleet` / `FleetMember`, and create-driver accepted optional `fleetId`, but there was no fleet management API. The dashboard Vehicles page used mock data.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/organizations/:organizationId/fleets` | List fleets (`id`, `name`, `color`, `memberCount`, …) |
| `POST` | `/organizations/:organizationId/fleets` | Create fleet `{ name, color? }` (`color` hex, default `#16a34a`) |
| `GET` | `/organizations/:organizationId/fleets/:fleetId` | Fleet detail with members |
| `PATCH` | `/organizations/:organizationId/fleets/:fleetId` | Update `{ name?, color? }` |
| `DELETE` | `/organizations/:organizationId/fleets/:fleetId` | Delete fleet |
| `POST` | `/organizations/:organizationId/fleets/:fleetId/drivers` | Assign `{ driverId }` |
| `DELETE` | `/organizations/:organizationId/fleets/:fleetId/drivers/:driverId` | Remove driver from fleet |

Related: create/update driver may include optional `fleetId`.

Also added: `GET /organizations/:id` (admin `system.organization` READ) so edit-org can load by query id.

Map markers for drivers include `fleetId`, `fleetName`, and `fleetColor` (from the driver’s most recent active fleet membership) so the dashboard can color pins by fleet.

## Dashboard

- **Fleets** (`/vehicles`): list/create/edit/delete fleets; color swatches; assign/remove drivers
- **Create Driver**: optional fleet picker
- **Map**: driver pins use `fleetColor` when assigned; hover shows fleet name
- **Partner Onboarding**: loads org by `?id=` when state is missing; suspend wired on org detail modal

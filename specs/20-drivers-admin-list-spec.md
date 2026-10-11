# Drivers — Admin List / Search

**Status:** Implemented  
**Endpoint:** `GET /api/v1/drivers`  
**Permission:** `system.driver` READ

## Purpose

Paginated driver search for admin UI (case create picker, etc.), matching the attorneys list pattern (`GET /api/v1/attorneys?search=&limit=&page=`).

## Query

| Param | Notes |
|---|---|
| `search` | Optional. Matches name, email, phone, VIN, license plate (case-insensitive) |
| `page` / `limit` / `cursor` / `sortBy` / `sortDir` | Standard pagination |

Empty `search` returns recent drivers (non-deleted).

## Response item shape

```json
{
  "id": "driver-uuid",
  "userId": "user-uuid",
  "name": "Alex Driver",
  "email": "driver@example.com",
  "phone": "+1...",
  "avatar": null,
  "vinNumber": "...",
  "licensePlate": "ABC-1234",
  "status": "ACTIVE",
  "organizations": [{ "id": "...", "name": "...", "region": "..." }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

`id` is the **Driver** id (use as `driverId` on case create).

## Dashboard usage

`InitiateCaseModal` loads drivers via `driverService.getDrivers({ search, limit: 10, page: 1 })` the same way attorneys are loaded.

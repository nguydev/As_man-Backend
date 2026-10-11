# Map Locations Markers — Change Spec

READ `AGENTS.md` on project root before implementing.

Related: `03-api-routes.md`, `07-location-socket-frontend-plan.md`, `06-location-socket-test-spec.md`, `17-flutter-map-integration.md`.

## 1. Scope

Extends `GET /api/v1/map/locations` beyond live Redis driver pins to return a mixed viewport of:

- **Drivers** — live Redis GEO/meta when present in the viewport; otherwise the driver’s **latest** `LocationHistory` row, included only if that last-known point is inside bounds
- **Organizations** — active orgs with an address inside the viewport
- **Attorneys** — attorneys with an address inside the viewport (scoped via cases linked to org drivers)
- **SOS** — unresolved SOS pins in bounds (managers/admins only; never for `DRIVER` membership)

Unaffected: socket ingest, SOS trigger/fan-out, history REST backfill.

## 2. Auth & Visibility

| Caller | Drivers / Orgs / Attorneys | SOS markers |
|---|---|---|
| `ADMIN` | All in viewport | All unresolved SOS in viewport |
| `OWNER` / `PROVIDER` | Scoped to those memberships’ orgs | SOS for drivers in those orgs only |
| `DRIVER` membership | Same fleet/org/attorney map for their orgs | **Never** (even if they also belong to the org as a driver) |
| Mixed (e.g. OWNER of A + DRIVER of B) | Orgs A+B fleet map | SOS only for org A |
| No visible orgs/drivers | Empty `{ clusters: [], markers: [] }` | |

Visibility is resolved once in `MapVisibilityService` (membership repo), not inside `LocationRepository`.

## 3. Query Contract

Existing `MapLocationsQueryDto`: `north`, `south`, `east`, `west`, `zoom` (1–22).

- Invalid bounds (`north <= south` or `east <= west`) → `400` with `locals.location.invalid_map_bounds`
- `zoom < 10` → `{ clusters, markers: [] }` (clusters over all roles)
- `zoom >= 10` → `{ clusters: [], markers }`

### 3.1 Overview (fit camera)

`GET /api/v1/map/overview` — no query params. Same JWT visibility as locations, **no viewport filter**.

Returns:

```json
{
  "empty": false,
  "center": { "lat": 40.7128, "lng": -74.006 },
  "bounds": {
    "north": 40.73, "south": 40.69,
    "east": -73.98, "west": -74.03
  },
  "zoom": 12,
  "counts": {
    "drivers": 5,
    "organizations": 1,
    "attorneys": 1,
    "sos": 1,
    "total": 8
  }
}
```

When the caller has no visible points: `empty: true`, `center`/`bounds`/`zoom` null, counts zeros.

Flutter: call overview on map open → fit camera → then `GET /map/locations` for that viewport.

## 4. Marker Shape

| Field | Drivers | Org / Attorney |
|---|---|---|
| `id` | driver id | entity id |
| `role` | `DRIVER` | `ORGANIZATION` / `ATTORNEY` |
| `live` | `true` if Redis, else `false` | always `false` |
| `lat` / `lng` | required | required |
| `name` / `avatar` | from profile | org name + logo / attorney name + avatar |
| `userId` / `driverId` / `unitNumber` / `speed` / `heading` / `deviceTs` / `receivedTs` | driver-only | omitted |
| `fleetId` / `fleetName` / `fleetColor` | most recent active fleet membership (hex), else `null` | omitted |
| `city` / `state` | omitted | from address when present |

Live Redis wins over history for the same `driverId`. Any driver present in `fleet:live` (not only those GEO-matched in the current viewport) is excluded from the history fallback so a live driver outside the box cannot leave a stale in-bounds ghost pin.

## 5. Data Access

- Redis GEO search for live drivers in bounds (markers)
- Redis `ZRANGE fleet:live` for the full live set used as history exclusions
- One `PrismaTransactionService.execute` transaction loads org markers, attorney markers, SOS, latest history rows, and driver metadata (independent reads via `Promise.all`)
- Address lat/lng are stored as strings → bounds use `CAST(... AS double precision)` in SQL
- History: `DISTINCT ON ("driverId") ... ORDER BY "driverId", "deviceTs" DESC` in a subquery, then filter that **last-known** row by bounds

## 6. Seed viewport

`prisma/seeds/location.seed.ts` seeds a coherent NYC hub so `owner@asman.com` sees markers:

- Org `ACTIVE` + address near `40.7128, -74.006`
- Five drivers as `DRIVER` members of that org with last-known history nearby
- Attorney + address + case linked to driver1
- One open SOS on driver1

Example:

```http
GET /api/v1/map/locations?north=40.75&south=40.68&east=-73.96&west=-74.05&zoom=12
```

## 7. Acceptance Checks

| # | Case | Expected |
|---|---|---|
| 6.1 | Driver live in Redis inside bounds | Marker `role=DRIVER`, `live=true` |
| 6.2 | Driver not live, last-known history in bounds | Marker `role=DRIVER`, `live=false` from latest history |
| 6.3 | Driver live (anywhere) + older history in bounds | Single live marker only if in viewport; history excluded globally while live |
| 6.4 | Active org address in bounds | `role=ORGANIZATION` marker |
| 6.5 | Attorney linked to org driver case, address in bounds | `role=ATTORNEY` marker for org-scoped caller |
| 6.6 | Entity outside bounds | Not returned |
| 6.7 | `zoom < 10` | Clusters only; `markers` empty |
| 6.8 | Caller with zero visible orgs and drivers | Empty clusters and markers |
| 6.9 | Caller with only `DRIVER` membership | Fleet markers allowed; **no** SOS markers |
| 6.10 | Caller with `OWNER`/`PROVIDER` membership | SOS markers for those orgs in viewport |
| 6.11 | Driver live outside viewport, stale history inside | No driver marker (history excluded while live) |
| 6.12 | Seeded owner + NYC bounds | Org, attorney, drivers, SOS markers present |

# Police/ICE Community Hazard Reports — Change Spec

READ `AGENTS.md` on project root before implementing.

Related: `16-map-locations-markers-spec.md`, `17-flutter-map-integration.md`, `07-location-socket-frontend-plan.md`.

This is **not** SOS and **not** Detention. Drivers warn each other about Police/ICE activity. Admins do not own the lifecycle.

## 1. Product rules

| | SOS | Detention | Police/ICE |
|---|---|---|---|
| Trigger | Driver long-press | Auto from location dwell | Driver tap |
| Who sees pin | Admin/org managers only | Org/system | **Other drivers** (same org/fleet map) |
| Lifecycle | Admin ack/resolve | Per-driver incident | Confirm/clear by drivers |

- Reporter name is **never** shown on the public pin.
- Copy: community report, not a verified law-enforcement location.
- GPS is required to create a report.
- Nearby reports within **400m** merge as a **confirm**, not a new pin.
- TTL is **3 hours**, refreshed on confirm.
- Cooldown is **2 minutes** between **new** pins from the same driver (confirms/clears are not cooldown’d).
- Clear when `clearCount >= confirmCount` **or** `clearCount >= 2` distinct clears.

## 2. Data model

New tables. Do **not** overload `IncidentAlert` (`SOS | DETENTION` only).

```
HazardReport
  id, type POLICE_ICE, status OPEN | CLEARED | EXPIRED
  lat, lon, radiusMeters (400)
  confirmCount, clearCount
  organizationId, createdByDriverId, createdByUserId
  lastReportedAt, expiresAt, clearedAt, clearedByDriverId

HazardVote
  hazardId, driverId, vote CONFIRM | CLEAR
  unique(hazardId, driverId)
```

Visibility for REST map + list: same org set as the existing fleet map (`OWNER | PROVIDER | DRIVER`). Admins see all open pins. SOS visibility (`OWNER | PROVIDER` only) must **not** gate hazards.

## 3. REST

JwtAuthGuard. Create / confirm / clear require an active `DRIVER` record.

- `POST /api/v1/hazards` `{ lat, lon }` → create or confirm nearby OPEN pin. Returns public payload + `merged`.
- `POST /api/v1/hazards/:id/confirm`
- `POST /api/v1/hazards/:id/clear`
- `GET /api/v1/hazards?north&south&east&west` → OPEN, unexpired pins in bounds for the caller’s map orgs.

Public payload (no reporter identity):

```json
{
  "id": "…",
  "role": "HAZARD",
  "type": "POLICE_ICE",
  "status": "OPEN",
  "lat": 40.71,
  "lng": -74.00,
  "name": "Police/ICE report",
  "detail": "Community report — not a verified law-enforcement location",
  "confirmCount": 2,
  "clearCount": 0,
  "radiusMeters": 400,
  "lastReportedAt": "…",
  "expiresAt": "…",
  "merged": false
}
```

## 4. Map + sockets

- `GET /map/locations` and `GET /map/overview` include `role: HAZARD` markers for DRIVER memberships (and managers/admins). Overview `counts.hazards`.
- Socket `/location`: emit `hazard:upsert` and `hazard:cleared` on `org:${id}:locations` and `map:admin:locations` (same rooms drivers already join). Do not put hazards on `:sos` rooms.
- Repeatable BullMQ job every 5 minutes expires `OPEN` rows with `expiresAt < now` and fans out `hazard:cleared`.

## 4.1 Driver notifications

A **new** pin (not a nearby merge/confirm) sends in-app + push to other **DRIVER** members in the reporter’s orgs. The reporter is excluded. Confirms/clears do not re-notify.

Payload `data.type` is `HAZARD` with `hazardId`, `lat`, `lng`. Copy: `locals.notifications.hazard_title` / `hazard_body`.

## 5. Flutter

- Home: SOS stays primary (long-press). Police/ICE is a secondary tap with a confirm sheet, then GPS + POST.
- Map: distinct pin (not SOS red). Tap sheet: Still there / No Police/ICE.
- Nav map: second FAB next to SOS.
- Approach warning (~1 mile) once per `hazardId` per session, detention-dialog style.
- Wire `LocationSocketService` for `hazard:upsert` / `hazard:cleared`.

# Flutter — Map API & Location Socket Integration Guide

**Audience:** Flutter / mobile frontend developers  
**Status:** Ready for client integration  
**Backend sources of truth:**

| Spec / code | Purpose |
|---|---|
| `specs/16-map-locations-markers-spec.md` | REST viewport markers + overview |
| `src/modules/location/map-location.controller.ts` | `GET /api/v1/map/locations`, `GET /api/v1/map/overview` |
| `src/modules/location/gateways/location.gateway.ts` | `/location` socket (ping, subscribe) |
| `src/modules/sos/gateways/sos.gateway.ts` | SOS trigger + admin SOS subscribe |
| `src/modules/sos/sos.controller.ts` | REST SOS fallback |

---

## 0. Quick start (copy this first)

1. Login → store `accessToken` + `refreshToken`.
2. Map open: `GET /api/v1/map/overview` → fit camera to `bounds` / `center`+`zoom`.
3. Then `GET /api/v1/map/locations?north&south&east&west&zoom` for that viewport.
4. Connect Socket.IO to `{API_ORIGIN}/location` with `auth: { token: accessToken }`.
5. Emit `map:subscribe` after every connect/reconnect.
6. Listen `location:update` → move driver pins; listen `sos:alert` only after SOS subscribe.
7. Debounce camera idle (~400ms) → refetch REST. Socket only updates **live drivers**.

**Seed accounts (password for all: `1qazxsw2`):**

| Email | Role | Use for |
|---|---|---|
| `owner@asman.com` | Org OWNER | Map + SOS (managers) |
| `admin@asman.com` | Platform ADMIN | Full map + `admin:sos:subscribe` |
| `driver1@asman.com` … `driver5@asman.com` | DRIVER | `location:ping` + `sos:trigger` |

Seeded NYC overview (after `pnpm` seed):

```http
GET /api/v1/map/overview
Authorization: Bearer <accessToken>
```

Then load markers in the returned bounds:

```http
GET /api/v1/map/locations?north=40.75&south=40.68&east=-73.96&west=-74.05&zoom=12
Authorization: Bearer <accessToken>
```

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Flutter                                                      │
│  MapCubit / MapController                                    │
│    ├─ REST  GET /api/v1/map/locations   → full viewport      │
│    │         (DRIVER / ORGANIZATION / ATTORNEY / SOS)        │
│    ├─ Socket.IO  namespace /location                          │
│    │    ├─ map:subscribe  (or dashboard:subscribe)           │
│    │    ├─ on location:update → upsert live DRIVER pin       │
│    │    └─ on sos:alert       → SOS banner (managers/admin)  │
│    └─ Driver app: location:ping + sos:trigger (+ REST SOS)   │
└──────────────────────────────────────────────────────────────┘
         │ HTTPS                              │ Socket.IO
         ▼                                    ▼
   Nest REST (/api/v1)                 Namespace: /location
```

**Rules:**

- REST owns the full mixed viewport (drivers, orgs, attorneys, SOS pins, clusters).
- Socket streams **live driver points only** (`location:update`). Org / attorney pins do **not** move over the socket — refetch REST when the camera settles.
- Server throttles live fan-out to ~**1 emit / 3 seconds / driver**. Client-side batching (`SchedulerBinding` / frame coalescing) is optional polish.
- Do **not** use raw WebSockets. Backend is Socket.IO (+ Redis adapter rooms).

---

## 2. Recommended packages

| Concern | Package | Notes |
|---|---|---|
| Maps | `google_maps_flutter` or `mapbox_maps_flutter` | Examples below use Google Maps |
| HTTP | `dio` | Auth interceptor + token refresh |
| Socket.IO | `socket_io_client` `^2.0.3+` | Must match Nest Socket.IO / Engine.IO |
| Driver GPS | `geolocator` (+ background plugin) | `deviceTs` = GPS capture time |
| Tokens | `flutter_secure_storage` | Access + refresh |
| State | Existing app pattern (`bloc` / `riverpod`) | Keep **markers** and **SOS alerts** in separate notifiers |

---

## 3. Auth

### 3.1 REST

```http
Authorization: Bearer <accessToken>
```

All map / SOS / history routes require JWT. Refresh via the existing auth session flow before the map mounts if expiry is near.

Login (typical):

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "owner@asman.com", "password": "1qazxsw2" }
```

### 3.2 Socket handshake

- Namespace: **`/location`**
- URL = API **origin without** `/api`  
  Example: `https://api.example.com/location` or `http://10.0.2.2:3000/location` (Android emulator → host)

Preferred auth (what the gateway reads first):

```dart
IO.io(
  '$apiOrigin/location',
  OptionBuilder()
      .setTransports(['websocket']) // polling OK as fallback
      .setAuth({'token': accessToken})
      .enableReconnection()
      .setReconnectionDelay(1000)
      .setReconnectionDelayMax(5000)
      .enableForceNew()
      .build(),
);
```

Also accepted:

- Handshake header `Authorization: Bearer <token>`
- Access-token cookie (web only — not typical on Flutter mobile)

**On every reconnect:** put a **fresh** access token in `auth` before handshake. Stale JWT → connection rejected.

Auth failure flow: REST refresh → reconnect. If refresh fails → force re-login.

---

## 4. REST — Map viewport

### 4.1 Endpoint

```http
GET /api/v1/map/locations
  ?north=<lat>
  &south=<lat>
  &east=<lng>
  &west=<lng>
  &zoom=<1-22>
Authorization: Bearer <accessToken>
```

| Query | Type | Rules |
|---|---|---|
| `north`, `south` | latitude | `north > south` |
| `east`, `west` | longitude | `east > west` |
| `zoom` | int 1–22 | `< 10` → clusters only; `≥ 10` → markers only |

Invalid bounds → `400`.

### 4.2 Response — markers (zoom ≥ 10)

```json
{
  "clusters": [],
  "markers": [
    {
      "id": "driver-uuid",
      "role": "DRIVER",
      "live": true,
      "lat": 40.7128,
      "lng": -74.006,
      "name": "Alice Driver",
      "avatar": "https://...",
      "userId": "user-uuid",
      "driverId": "driver-uuid",
      "unitNumber": "ASMAN-001",
      "speed": 42.5,
      "heading": 180,
      "deviceTs": "2026-07-31T12:00:00.000Z",
      "receivedTs": "2026-07-31T12:00:01.000Z"
    },
    {
      "id": "org-uuid",
      "role": "ORGANIZATION",
      "live": false,
      "lat": 40.7128,
      "lng": -74.006,
      "name": "Asman Logistics",
      "avatar": "https://...",
      "city": "New York",
      "state": "NY"
    },
    {
      "id": "attorney-uuid",
      "role": "ATTORNEY",
      "live": false,
      "lat": 40.72,
      "lng": -74.00,
      "name": "Alex Counsel",
      "avatar": "https://...",
      "city": "New York",
      "state": "NY"
    },
    {
      "id": "incident-uuid",
      "role": "SOS",
      "live": true,
      "lat": 40.713,
      "lng": -74.005,
      "driverId": "driver-uuid",
      "name": "Alice Driver",
      "avatar": "https://...",
      "status": "OPEN",
      "detail": "optional message",
      "createdAt": "2026-07-31T12:05:00.000Z"
    }
  ]
}
```

### 4.3 Response — clusters (zoom < 10)

```json
{
  "clusters": [
    { "lat": 40.72, "lng": -74.00, "count": 12, "drivers": 12 }
  ],
  "markers": []
}
```

`drivers` currently equals `count` (all roles). Prefer **`count`** in UI labels.

### 4.4 Marker roles

| `role` | Source | Moves via socket? |
|---|---|---|
| `DRIVER` | Redis live **or** latest `LocationHistory` | Yes — only after `location:update` / while `live` |
| `ORGANIZATION` | Org address | No — REST only |
| `ATTORNEY` | Attorney address | No — REST only |
| `SOS` | Unresolved incident in viewport | No live move — REST + `sos:alert` for new ones |

- `live: true` on DRIVER = currently in Redis GEO.
- `live: false` on DRIVER = last-known history (use stale / grey styling).
- SOS REST markers are only returned for OWNER / PROVIDER / ADMIN visibility — **never** for callers who only have DRIVER membership.

### 4.5 When to call REST

| Trigger | Action |
|---|---|
| Map screen open | Fetch current camera bounds + zoom |
| Camera idle (debounce 300–500ms) | Refetch |
| Zoom crosses 10 | Refetch (cluster ↔ marker mode) |
| Socket reconnect | Refetch viewport, then resume live merges |
| Pull-to-refresh | Refetch |

Do **not** hit REST on every `onCameraMove` frame.

---

## 5. Socket — event contract

Namespace: **`/location`**.

### 5.1 Client → server

| Event | Who | Body | Ack / return |
|---|---|---|---|
| `map:subscribe` | Map viewer (any authenticated user with map visibility, or ADMIN) | _(none)_ | `{ subscribed: true, scope: "admin" }` **or** `{ subscribed: true, scope: "organizations", organizationIds: string[] }` |
| `dashboard:subscribe` | Org manager only | `{ "organizationId": "<uuid>" }` | `{ subscribed: true }` — joins **both** `org:{id}:locations` and `org:{id}:sos` |
| `admin:sos:subscribe` | ADMIN or `SYSTEM_SOS` read permission | _(none)_ | `{ subscribed: true }` |
| `location:ping` | Driver only | see §7 | ingested `LiveLocation` |
| `sos:trigger` | Driver only | `{ lat?, lon?, message? }` | created incident |

### 5.2 Server → client

| Event | Payload | When |
|---|---|---|
| `location:update` | `LiveLocation` | Throttled (~1 / 3s / driver) after ingest |
| `sos:alert` | Incident + `organizationIds` | Immediate (not throttled with locations) |

```ts
// location:update
{
  driverId: string;
  lat: number;
  lon: number;       // NOTE: lon — REST uses lng
  speed?: number;
  heading?: number;
  deviceTs: string;  // ISO-8601
  receivedTs: string;
}
```

```ts
// sos:alert (socket fan-out)
{
  id: string;
  driverId: string;
  type: "SOS";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | ...;
  lat?: number | string | null;
  lon?: number | string | null;
  message?: string | null;
  triggeredById?: string | null;
  createdAt: string;
  updatedAt: string;
  organizationIds: string[];
  // plus other IncidentAlert columns as returned by Prisma create
}
```

**Normalize coordinates in Flutter:** map socket `lon` → UI `lng`. REST already uses `lng`.

### 5.3 Which subscribe for the map screen

| Viewer | Calls |
|---|---|
| Multi-org / home fleet map | `map:subscribe` once after connect (+ every reconnect) |
| Single-org dashboard | `dashboard:subscribe` with that `organizationId` (locations **and** SOS) |
| Platform ADMIN wanting SOS | `map:subscribe` **and** `admin:sos:subscribe` |

`map:subscribe`:

- ADMIN → room `map:admin:locations` (all live driver updates)
- Org-scoped user → `org:{id}:locations` for each visible org

`map:subscribe` does **not** join SOS rooms. For SOS over socket use `dashboard:subscribe` or `admin:sos:subscribe`.

**Always re-emit subscribe after reconnect** — Socket.IO room membership does not survive reconnects.

### 5.4 Important: manager vs driver on the same socket

If the authenticated user has a `Driver` row, the gateway attaches `driverId` to the socket.

- `location:ping` / `sos:trigger` → require `driverId` (driver app).
- `dashboard:subscribe` → **rejects** if `driverId` is set (managers must not be treated as drivers on that connection).

Implication for Flutter: use **owner/admin accounts** for the org map SOS path (`dashboard:subscribe`). Driver accounts use `map:subscribe` for live fleet pins but do **not** get SOS rooms / SOS REST markers.

There is **no** `dashboard:unsubscribe` today. To switch orgs cleanly: disconnect → reconnect → subscribe only to the active org (or keep rooms and filter UI-side). Prefer reconnect + resubscribe.

---

## 6. Flutter map screen — recommended flow

### 6.1 Models

```dart
enum MapRole { driver, organization, attorney, sos }

class MapMarker {
  final String id;
  final MapRole role;
  final double lat;
  final double lng;
  final bool live;
  final String? name;
  final String? avatar;
  // DRIVER
  final String? userId;
  final String? driverId;
  final String? unitNumber;
  final double? speed;
  final double? heading;
  final DateTime? deviceTs;
  final DateTime? receivedTs;
  // ORGANIZATION / ATTORNEY
  final String? city;
  final String? state;
  // SOS
  final String? status;
  final String? detail;
  final DateTime? createdAt;
}

class MapCluster {
  final double lat;
  final double lng;
  final int count;
}

/// Keyed by marker id (driverId for drivers; incident id for SOS).
typedef MarkerStore = Map<String, MapMarker>;
```

### 6.2 Bootstrap + live merge

```
1. connect socket (fresh access token in auth)
2. emit map:subscribe (await ack if available)
3. if manager SOS needed: dashboard:subscribe or admin:sos:subscribe
4. GET /map/locations for camera bounds → replace markers / clusters
5. on location:update:
     - upsert DRIVER by driverId
     - set live=true; map lon → lng
     - optionally hide if outside current bounds
6. on sos:alert → SosAlertCubit (banner / modal); optionally upsert SOS pin
7. onCameraIdle (debounced) → REST refetch; keep socket positions newer than REST
8. onReconnect → refresh token → resubscribe → REST refetch
```

**Merge rule when REST returns:**

- Org / attorney / SOS markers → replace from REST.
- DRIVER: if socket has newer `deviceTs` for that `driverId`, keep socket position; else use REST.
- Prefer keying drivers by `driverId` (same as `id` for DRIVER markers).

### 6.3 Stale drivers

If no `location:update` for ~30s, paint as **stale** (dimmed). Do not remove until the next REST snapshot drops them or they leave the viewport.

### 6.4 Clusters

When REST returns `clusters` (zoom < 10):

- Draw cluster circles with `count`.
- On tap → animate camera toward that lat/lng; let REST refetch markers.

### 6.5 Icons

| Role | UI |
|---|---|
| `DRIVER` + `live` | Vehicle pin; rotate by `heading` if present |
| `DRIVER` + `!live` | Grey / hollow vehicle pin |
| `ORGANIZATION` | Building / logo |
| `ATTORNEY` | Person / avatar |
| `SOS` | High-priority alert pin (never treat as a normal driver) |

---

## 7. Driver app — ping + SOS

### 7.1 `location:ping`

```json
{
  "lat": 40.7128,
  "lon": -74.0060,
  "speed": 40.0,
  "heading": 90.0,
  "deviceTs": "2026-07-31T12:00:00.000Z"
}
```

| Field | Notes |
|---|---|
| `lat` / `lon` | Required; use **lon** (not lng) |
| `speed` | Optional ≥ 0 |
| `heading` | Optional 0–360 |
| `deviceTs` | Required ISO-8601 — GPS **capture** time, not send time |

- Cadence: 3–10s (default **5s** if no remote config).
- While offline: keep a small ring buffer; on reconnect send **current** position only (do not dump the buffer over the socket).
- Background GPS is required for fleet safety (iOS background modes / Android foreground service).

Ack returns the ingested live point (includes `driverId`, `receivedTs`).

### 7.2 SOS

**Primary — socket:**

```text
emit sos:trigger
{ "lat": 40.7128, "lon": -74.0060, "message": "optional" }
```

**Fallback — REST** (disconnected or no ack within ~2s):

```http
POST /api/v1/sos/trigger
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "lat": 40.7128, "lon": -74.0060, "message": "optional" }
```

- Never gate the SOS button on socket connected state.
- Optimistic haptic/UI on tap; separate “delivered” state on ack / REST 2xx.
- Log locally: timestamp + path (`socket` | `rest`) for audit.

### 7.3 Map viewers receiving SOS

| Viewer | How they get `sos:alert` |
|---|---|
| Org OWNER / PROVIDER | `dashboard:subscribe` → room `org:{orgId}:sos` |
| ADMIN (+ SOS permission) | `admin:sos:subscribe` → room `admin:sos` |
| DRIVER membership only | No SOS rooms; no SOS markers on REST map |

Render as a persistent banner / modal (not a dismissible toast). Tap → driver / incident detail.

---

## 8. History backfill (reconnect gap)

Socket does **not** replay missed live events.

```http
GET /api/v1/organizations/{organizationId}/location/drivers/{driverId}/history?since={ISO-8601}
Authorization: Bearer <accessToken>
```

Roles: `OWNER` | `PROVIDER` (org guard).

Use after reconnect for visible drivers: `since = lastKnown deviceTs`. Apply to polylines / trip UI; for the live pin prefer the latest point then resume `location:update`.

---

## 9. Example wiring

### 9.1 Socket client

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class LocationSocket {
  IO.Socket? _socket;
  final String apiOrigin;
  final String Function() tokenProvider;

  LocationSocket({required this.apiOrigin, required this.tokenProvider});

  void connect({required void Function(dynamic) onLocationUpdate,
                required void Function(dynamic) onSosAlert}) {
    _socket?.dispose();
    _socket = IO.io(
      '$apiOrigin/location',
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': tokenProvider()})
          .enableForceNew()
          .enableReconnection()
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(5000)
          .build(),
    );

    _socket!.onConnect((_) {
      // Nest @SubscribeMessage return value is the ack payload
      _socket!.emitWithAck('map:subscribe', null, ack: (data) {
        // data.scope == 'admin' | 'organizations'
      });
    });

    _socket!.on('location:update', onLocationUpdate);
    _socket!.on('sos:alert', onSosAlert);

    _socket!.onConnectError((e) {
      // refresh access token → connect() again; else logout
    });
  }

  void subscribeOrgDashboard(String organizationId) {
    _socket?.emitWithAck(
      'dashboard:subscribe',
      {'organizationId': organizationId},
      ack: (_) {},
    );
  }

  void subscribeAdminSos() {
    _socket?.emitWithAck('admin:sos:subscribe', null, ack: (_) {});
  }

  void ping(Map<String, dynamic> body) {
    _socket?.emitWithAck('location:ping', body, ack: (_) {});
  }

  void triggerSos(Map<String, dynamic> body) {
    _socket?.emitWithAck('sos:trigger', body, ack: (_) {});
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
  }
}
```

If `emitWithAck` is awkward on your `socket_io_client` version, fire-and-forget subscribe and treat receiving `location:update` as proof of room join.

### 9.2 REST client

```dart
Future<MapLocationsResponse> fetchMap({
  required Dio dio,
  required double north,
  required double south,
  required double east,
  required double west,
  required int zoom,
}) async {
  final res = await dio.get(
    '/api/v1/map/locations',
    queryParameters: {
      'north': north,
      'south': south,
      'east': east,
      'west': west,
      'zoom': zoom,
    },
  );
  return MapLocationsResponse.fromJson(res.data as Map<String, dynamic>);
}
```

### 9.3 Camera idle

```dart
Timer? _debounce;

void onCameraIdle(GoogleMapController c) {
  _debounce?.cancel();
  _debounce = Timer(const Duration(milliseconds: 400), () async {
    final bounds = await c.getVisibleRegion();
    final zoom = await c.getZoomLevel();
    final snap = await fetchMap(
      dio: dio,
      north: bounds.northeast.latitude,
      south: bounds.southwest.latitude,
      east: bounds.northeast.longitude,
      west: bounds.southwest.longitude,
      zoom: zoom.round().clamp(1, 22),
    );
    markerStore.applySnapshot(snap);
  });
}
```

---

## 10. Visibility & ACL (do not re-implement as security)

| Role | Map REST | Live updates | SOS (REST markers / socket) |
|---|---|---|---|
| ADMIN | All in viewport | `map:subscribe` → admin room | REST SOS + `admin:sos:subscribe` |
| OWNER / PROVIDER | Own orgs + linked attorneys + org drivers | `map:subscribe` or `dashboard:subscribe` | REST SOS for those orgs; socket via `dashboard:subscribe` |
| DRIVER (viewer) | Own memberships’ orgs / drivers | `map:subscribe` | **No** SOS on REST map; do not join SOS rooms |
| DRIVER (emitter) | — | emit `location:ping` | emit `sos:trigger` / REST fallback |

Empty visibility → `{ "clusters": [], "markers": [] }`.

Never treat client-side filtering of live events as a security boundary — rooms are ACL’d at join time.

---

## 11. Errors & edge cases

| Case | Client behavior |
|---|---|
| Socket connect rejected | Refresh token → reconnect; else logout |
| `map:subscribe` fails | Show “live updates unavailable”; REST map still works |
| Empty markers + clusters | Empty-state copy (“No units in this area”) |
| Driver leaves org mid-trip | Updates stop; next REST snapshot drops them |
| Clock skew on `deviceTs` | Accept; stale UI uses wall-clock since last update |
| Zoom thrash around 10 | Debounce; avoid request storms |
| Duplicate markers | Always key drivers by `driverId` / `id` |
| Live driver outside viewport + stale history inside | Backend excludes history while live — expect **no** ghost pin |
| `lon` vs `lng` mix-up | Normalize once in mappers |

---

## 12. Phased build order (Flutter)

1. Auth + Dio + secure token storage  
2. Map screen + REST `/map/locations` + marker/cluster rendering (incl. SOS role)  
3. Socket wrapper (connect, auth refresh, reconnect)  
4. `map:subscribe` + `location:update` merge into marker store  
5. Manager SOS listen (`dashboard:subscribe` / `admin:sos:subscribe`)  
6. Driver app: `location:ping` + background GPS  
7. Driver SOS: socket + REST fallback  
8. History backfill on reconnect  
9. Load test: many simulated pings against one map client  

---

## 13. Acceptance checklist

- [ ] Map loads DRIVER (live + history), ORGANIZATION, ATTORNEY, and SOS markers in viewport (role-appropriate)
- [ ] Zoom < 10 → clusters; zoom ≥ 10 → markers
- [ ] Live driver pins move on `location:update` without full map rebuild
- [ ] Camera idle refetches REST without hammering the API
- [ ] Reconnect re-subscribes and refreshes viewport
- [ ] SOS alert appears for managers/admins (persistent UI, not a silent toast)
- [ ] Driver SOS works when socket is down via REST fallback
- [ ] Socket `lon` and REST `lng` both map correctly
- [ ] No tokens / secrets in logs
- [ ] Seeded `owner@asman.com` + NYC bounds shows org, attorney, drivers, SOS

---

## 14. Backend notes (do not assume otherwise)

- No `dashboard:unsubscribe` — reconnect to drop rooms.
- `map:subscribe` does **not** join SOS rooms.
- Cluster field `drivers` equals `count` today — label with `count`.
- Handshake does **not** consume a client `lastAckedDeviceTs`; use REST history backfill for gaps.
- Live fan-out throttle is server-side (~3s); clients should not expect 1 Hz updates.
- Swagger: open `/api/docs` (or your env’s Swagger path) for HTTP schemas; sockets are documented here.

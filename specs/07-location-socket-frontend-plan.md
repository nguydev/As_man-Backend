# Location & SOS Socket — Frontend Implementation Plan

Source: `01-system-technical-specs.md` §5, `03-api-routes.md`, `06-location-socket-test-spec.md`.

## 1. Scope

Two consumers of the `/location` namespace:

- **Driver app** (Expo/React Native) — emits `location:ping`, `sos:trigger`.
- **Org dashboard** (Next.js) — emits `dashboard:subscribe`, renders live positions + SOS alerts.

## 2. Shared Socket Client Wrapper

One `socket.io-client` instance per app lifecycle, namespace `/location`. Confirm whether this lives in a shared package or gets duplicated per app before starting — don't assume a monorepo shared package exists.

Responsibilities:

- Handshake auth via `auth: { token }` — refresh the access token *before* connecting if it's near expiry, not after a rejected connection.
- Reconnection: exponential backoff (`reconnectionDelay: 1000, reconnectionDelayMax: 5000`), re-send a fresh access token on every reconnect attempt since it may have rotated via REST refresh while disconnected.
- Expose a typed event bus (`onPing`, `onSosAlert`, `onConnect`, `onDisconnect`, `onReconnect`, `onAuthError`) — don't leak the raw `socket.io` API into components.

## 3. Driver App (Expo/React Native)

### 3.1 Location emission

- `expo-location` background task (`Location.startLocationUpdatesAsync`) — foreground-only emission is not acceptable for a fleet-safety product. Confirm background permission flow (iOS background modes, Android foreground service) is already set up before wiring the socket in.
- Ping cadence 3–10s per tech spec; pull from remote config if runtime-tunable, otherwise hardcode 5s.
- Local ring buffer (capped) while disconnected. On reconnect: send only current position immediately, don't dump the full buffer over the socket. Whether buffered gap points get uploaded at all depends on whether the backend accepts driver-side gap upload — currently the spec only defines *dashboard-side* backfill via REST history (§5.8). Confirm with backend before building buffer upload.
- `deviceTs` = capture time, not send time — required for correct detention/dwell math after a reconnect.

### 3.2 Connection status UI

- Persistent, unobtrusive connected/reconnecting/offline indicator — driver needs confidence the SOS path works before they need it.
- SOS button must never be gated on socket connection state (see 3.3).

### 3.3 SOS trigger

- Primary: `sos:trigger` over the socket.
- Fallback: if disconnected, or no ack within ~2s, fall back immediately to `POST /sos/trigger` over REST. SOS delivery must never wait on socket reconnection.
- Optimistic local confirmation (haptic + visual) on tap; separate "delivered" state once server ack arrives.
- Log every SOS attempt locally (timestamp, path used: socket vs REST) — undelivered SOS is a serious failure mode for a legal-safety product, worth its own audit trail independent of the backend's `IncidentAlert`.

### 3.4 Auth handling

- On `onAuthError`, trigger the existing REST refresh flow, then reconnect silently. Only surface an error to the driver if refresh itself fails (prompt re-login).

## 4. Org Dashboard (Next.js)

### 4.1 Subscription lifecycle

- Emit `dashboard:subscribe` on mount and on every org switch (multi-org admin view).
- The backend spec has no documented `dashboard:unsubscribe` event. Confirm with backend whether switching orgs needs a fresh socket connection or whether stale room membership persists — don't guess client-side. Flagged in the edge case report.
- Re-subscribe on every `onReconnect` — Socket.IO room membership does not survive reconnects (test spec §8.4).

### 4.2 Map rendering

- Client-side `Map<driverId, { lat, lon, heading, speed, receivedAt }>`, updated per `location:ping` broadcast. Diff by `driverId`, don't re-render the full marker list per event.
- Server already throttles to ~1 publish/3s per driver, so client-side re-render throttling is optional but recommended at fleet scale — batch marker updates per animation frame (`requestAnimationFrame`) rather than per socket event.
- Stale-marker handling: if no ping for a driver within ~30s, mark visually as stale/offline rather than leaving a frozen marker with no indication. This is a client-side UX decision, not something the backend spec dictates.

### 4.3 SOS alerts

- Dedicated `org:{orgId}:sos` listener, kept separate from the throttled location stream.
- Render as a persistent, dismiss-requires-action banner/modal — not a toast, which can be missed.
- Distinct sound/visual treatment from normal UI updates.
- Click-through should open driver detail + the `IncidentAlert` record — confirm a read endpoint exists beyond creation, or add it to the backend backlog.

### 4.4 Reconnect / gap handling

- On reconnect, call `GET /organizations/:organizationId/location/drivers/:driverId/history?since=<lastKnownTs>` per visible driver to fill the gap, then resume live updates. Matches the backend's documented approach (tech spec §5.8) — don't try to build gap-filling into the socket layer itself.

## 5. State Management

- Driver app: local/lightweight store (match existing app pattern, e.g. Zustand) for connection status only — ping data is fire-and-forget, no need for a global store.
- Dashboard: one map-scoped store holding live driver positions, kept separate from SOS alert state — different lifecycle and urgency, shouldn't share re-render triggers.

## 6. Phased Build Order

1. Shared socket client wrapper (both apps) — auth + reconnect handling.
2. Driver app: ping emission + connection status UI.
3. Driver app: SOS trigger (socket primary, REST fallback) — build before dashboard SOS UI so there's something to test against.
4. Dashboard: subscribe + live marker rendering.
5. Dashboard: SOS alert UI.
6. Both: reconnect/backfill wiring.
7. Load test: simulate N concurrently-pinging drivers against a dashboard subscribed to all of them — verifies the client doesn't degrade under the server's throttle assumptions.

## 7. Open Questions for Backend (blockers before dashboard build)

- Is there a `dashboard:unsubscribe` event, or does switching orgs require a fresh connection?
- Is `org:{orgId}:sos` room join implicit on `dashboard:subscribe`, or a separate call?
- Is there a `GET /incidents/:id` (or equivalent) read route for the SOS click-through?

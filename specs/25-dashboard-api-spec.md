# Dashboard APIs

**Status:** Implemented

## Endpoints

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/api/v1/admin/dashboard/stats` | `system.sos` READ | Platform stats, active SOS, placeholder feeds |
| `GET` | `/api/v1/organizations/:organizationId/dashboard` | Org `OWNER` / `PROVIDER` | Org-scoped home dashboard |

## Admin response

```json
{
  "stats": {
    "subscribers": 0,
    "activeDrivers": 0,
    "fleets": 0,
    "attorneys": 0,
    "sosToday": 0,
    "inIceDetention": 0
  },
  "activeSosAlarms": [],
  "enforcementAlerts": [],
  "newsFeed": [],
  "facilities": [],
  "lastLocations": []
}
```

`enforcementAlerts` / `newsFeed` are empty until aggregators exist. Dashboard UI shows empty states.

## Organization response

```json
{
  "stats": {
    "activeDrivers": 0,
    "fleets": 0,
    "openCases": 0,
    "sosOpen": 0
  },
  "driverActivity": [
    { "day": "Fri", "date": "2026-07-25", "active": 2 }
  ],
  "recentSos": [
    {
      "id": "…",
      "name": "Driver Name",
      "avatar": null,
      "detail": "SOS",
      "status": "OPEN",
      "timeAgo": "5 min ago",
      "createdAt": "…"
    }
  ]
}
```

- **activeDrivers** — active `DRIVER` memberships with active driver profiles  
- **fleets** — fleets in the organization  
- **openCases** — cases for org drivers in `OPEN` / `IN_PROGRESS` / `HEARING` / `REOPENED`  
- **sosOpen** — unresolved SOS for org drivers  
- **driverActivity** — last 7 days, distinct drivers with `LocationHistory` that day  

## Dashboard

- Super Admin home → `dashboardService.getStats()`
- Fleet Owner home → `dashboardService.getOrganizationDashboard(orgId)`

# Organization Driver Cases

**Status:** Implemented  
**Endpoint:** `GET /api/v1/organizations/:organizationId/cases`  
**Access:** Organization `OWNER` or `PROVIDER` (not `system.case`)

## Why

Fleet Case Status previously called admin `GET /cases` (`system.case` READ). Org owners got 403 and the UI showed an empty “all clear” state.

## Behavior

Returns paginated cases whose **driver** has an active `DRIVER` membership in the organization. Same list filters/sort as admin list (`status`, `search`, pagination).

## Dashboard

`FleetCaseStatus` loads via `caseService.listOrganizationCases(orgId, params)`.

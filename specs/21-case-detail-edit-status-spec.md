# Case Detail — Edit & Status Transitions

**Status:** Implemented  
**Pages:** Dashboard `CaseDetail` (`/case-tracker/:caseId`)

## Problems fixed

1. **Edit Case** button had no handler and there was no update API.
2. **Update Status** modal used fake labels (`active`, `hearing`, `completed`, …) that did not match `CaseStatus` (`OPEN`, `IN_PROGRESS`, `CLOSED`, `ARCHIVED`), so status changes failed validation.

## API

### `PATCH /api/v1/cases/:id`

Update case details (not status).

Body (all optional):

- `attorneyId`, `driverId`
- `court` — when set, must be one of the attorney’s `courts` (if that list is non-empty)
- `hearingDate` (ISO datetime or `null`)
- `summary` (or `null`)

Permission: `system.case` WRITE

### `PATCH /api/v1/cases/:id/status`

Unchanged transitions:

| From | Allowed next |
|---|---|
| `OPEN` | `IN_PROGRESS`, `CLOSED`, `ARCHIVED` |
| `IN_PROGRESS` | `CLOSED`, `ARCHIVED` |
| `CLOSED` | `ARCHIVED` |
| `ARCHIVED` | _(none)_ |

Closing requires `outcome`: `WIN` | `LOSE`.

### `GET /api/v1/cases/:id/tracker`

Now also returns `allowedTransitions: CaseStatus[]` for the current status so the UI stays in sync with the server.

## Dashboard

- **Edit Case** modal: court (from attorney courts), hearing date, summary → `updateCase`.
- **Update Status** modal: options = `allowedTransitions`; outcome field when selecting `CLOSED`; posts to `changeCaseStatus`.
- Progress chips bind to tracker `progress`.

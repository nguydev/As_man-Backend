# Case Status Lifecycle (Start → End)

**Status:** Implemented  
**Migration:** `20260731112709_expand_case_status_lifecycle`

## Statuses (start → end)

Happy path:

1. `OPEN` — case created  
2. `IN_PROGRESS` — work underway  
3. `HEARING` — hearing scheduled / in hearing  
4. `CLOSED` — finished (`outcome`: `WIN` | `LOSE`)  
5. `ARCHIVED` — final storage  

Side paths:

- `CANCELLED` — dropped / withdrawn  
- `REOPENED` — brought back from `CLOSED` or `CANCELLED`

## Allowed transitions

| From | Allowed next |
|---|---|
| `OPEN` | `IN_PROGRESS`, `CANCELLED`, `ARCHIVED` |
| `IN_PROGRESS` | `HEARING`, `CLOSED`, `CANCELLED`, `ARCHIVED` |
| `HEARING` | `IN_PROGRESS`, `CLOSED`, `CANCELLED` |
| `CLOSED` | `REOPENED`, `ARCHIVED` |
| `CANCELLED` | `REOPENED`, `ARCHIVED` |
| `REOPENED` | `IN_PROGRESS`, `HEARING`, `CLOSED`, `CANCELLED` |
| `ARCHIVED` | _(none)_ |

Closing requires `outcome`. Reopen / cancel clears outcome. Archive keeps prior outcome.

## API notes

- Tracker returns `allowedTransitions` for the current status.
- Progress chips: `OPEN → IN_PROGRESS → HEARING → CLOSED` (+ side badge for cancelled/reopened/archived).
- List supports `?status=` and `?search=` (court / id).
- Stats: active = open/in progress/hearing/reopened; completed = closed+win; failed = closed+lose or cancelled.

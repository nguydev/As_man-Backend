# List API Pagination

## Contract

Unbounded REST collection endpoints accept these optional query parameters:

- `cursor`: opaque cursor returned by the previous response.
- `page`: one-based page number. Supplying it selects offset pagination.
- `limit`: items per page, from 1 through 150. The default is 10.
- `sortBy`: endpoint-specific sortable field documented as a Swagger enum.
- `sortOrder`: `asc` or `desc`. Each endpoint defines its default.

`cursor` and `page` cannot be combined. Omitting `page` selects cursor
pagination, including for the first request where no cursor exists yet.
Cursor tokens include the active sort field and direction. A cursor cannot be
reused with different sorting parameters.

Examples:

```text
GET /api/v1/attorneys?limit=25&sortBy=yearsOfExperience&sortOrder=desc
GET /api/v1/cases?page=2&limit=20&sortBy=createdAt&sortOrder=asc
```

Paginated responses use the standard response envelope:

```json
{
  "success": true,
  "message": "Data fetched successfully",
  "statusCode": 200,
  "data": [],
  "pagination": {
    "mode": "cursor",
    "limit": 10,
    "cursor": null,
    "nextCursor": null,
    "hasNext": false
  }
}
```

Offset responses additionally return `total`, `page`, `totalPages`,
`hasNext`, and `hasPrev`.

## Covered endpoints

- `GET /api/v1/attorneys`
- `GET /api/v1/cases`
- `GET /api/v1/organizations`
- `GET /api/v1/files`
- `GET /api/v1/vault`
- `GET /api/v1/vault/organizations/:organizationId/documents`
- `GET /api/v1/vault/organizations/:organizationId/drivers/:driverId`
- `GET /api/v1/sos/contacts`
- `GET /api/v1/subscriptions/plans`
- `GET /api/v1/subscriptions/organizations/:organizationId`

## Intentional exclusions

- Location history remains a timestamp-based backfill capped at 1,000 points.
- Two-factor methods and backup-code counts are bounded security metadata.
- SOS notification processing loads all contacts because partial fan-out is not
  valid behavior.

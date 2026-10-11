# Attorney Import Spec

## Purpose

Periodically sync finalized attorney profiles from the external Attorney Automation API into local `Attorney` records so admins can assign them to cases without manual data entry.

## Source

- Base URL: `ATTORNEY_IMPORT_BASE_URL` (default `http://ec2-16-16-170-72.eu-north-1.compute.amazonaws.com`)
- Endpoint: `GET /api/attorneys/finalized?page=&limit=&minCases=`
- Only finalized profiles (completed + case-count threshold, default `minCases=1`) are imported
- Full catalog `GET /api/attorneys/` is out of scope

## Schedule

- BullMQ queue: `attorney-import`
- Job name: `sync`
- Default cron: `0 3 * * *` (daily 03:00 UTC), overridable via `ATTORNEY_IMPORT_CRON`
- Disabled when `ATTORNEY_IMPORT_ENABLED=false` (scheduler is removed on boot)

## Manual trigger

- `POST /api/v1/attorneys/import`
- Auth: JWT + `system.attorney` WRITE
- Enqueues the same `sync` job immediately and returns `{ jobId }`
- Returns 503 with localized `import_disabled` when import is disabled

## Idempotency

- Remote `id` stored as `Attorney.externalId` (unique)
- `Attorney.externalSource` set to `ATTORNEY_AUTOMATION`
- Re-runs upsert by `externalId` (create or update)
- Email unique conflicts omit the email rather than failing the row

## Field mapping

| Remote | Local |
|---|---|
| `id` | `externalId` |
| `courtListenerId` | `courtListenerId` |
| `fullName` | `name` |
| `email` | `email` |
| `phone` | `phone` |
| `fax` | `fax` |
| `website` | `website` |
| `linkedin` | `linkedin` |
| `barNumber` | `barLicenseNumber` |
| `photo` | `avatarUrl` |
| `yearsExperience` | `yearsOfExperience` |
| `languages` | `languageProficiencies` |
| `practiceAreas` / `districts` / `courts` | `specialties` (fallback `General Practice`) |
| `states` | `states` |
| `courts` | `courts` |
| `districts` | `districts` |
| `professionalSummary` or `biography` | `about` |
| `districts[0]` / `courts[0]` | `federalCircuit` |
| `totalCases` | `remoteTotalCases` |
| `wonCases` | `remoteWonCases` |
| `lostCases` | `remoteLostCases` |
| `pendingCases` | `remotePendingCases` |
| `winRate` | `remoteWinRate` |
| `lastCaseDate` | `lastCaseDate` |
| `contactRaw` + `states` | best-effort `address` |
| — | `verified = true` |
| — | `lastImportedAt = now()` |

Rows without `fullName` are skipped.

`totalCases` / `winCases` on API responses remain local Case-derived counts and are not overwritten by remote stats.

## Config

| Env | Default |
|---|---|
| `ATTORNEY_IMPORT_BASE_URL` | Attorney Automation host |
| `ATTORNEY_IMPORT_ENABLED` | `true` |
| `ATTORNEY_IMPORT_CRON` | `0 3 * * *` |
| `ATTORNEY_IMPORT_PAGE_SIZE` | `50` |
| `ATTORNEY_IMPORT_MIN_CASES` | `1` |

## Out of scope

- Importing non-finalized remote attorneys
- Creating local cases from remote case stats / win rates
- Persisting `latestCase` / `contactRaw` blobs
- Geocoding imported addresses

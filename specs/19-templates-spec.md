# Templates Module — Change Spec

READ `AGENTS.md` on project root before implementing.

## 1. Scope

Admin-managed reusable **markdown** content templates (notices, email bodies, copy blocks), plus template-based email send to a person or org contact email with send history.

- Prisma models `Template`, `EmailDispatch`
- Nest module `TemplatesModule` under `/api/v1/templates`
- Permission: `system.template` (`AuthPermission.SYSTEM_TEMPLATE`)
- Platform `ADMIN` bypasses permission checks

## 2. Schema

`Template` — unique title, markdown `content`, `addedBy`.

`EmailDispatch` — audit row for each send:

- `recipientType`: `USER` | `ORGANIZATION`
- Org sends use **only** `Organization.email`
- `status`: `QUEUED` → `SENT` / `FAILED` (updated by `MailProcessor`)
- Snapshots: `templateTitle`, `bodyMarkdown`, `bodyHtml`, `toEmail`, `subject`

Migrations: `20260731102637_add_templates`, `20260731105159_add_email_dispatches`.

## 3. API

| Method   | Path                          | Permission | Notes                                             |
| -------- | ----------------------------- | ---------- | ------------------------------------------------- |
| `POST`   | `/api/v1/templates`           | WRITE      | Create template                                   |
| `POST`   | `/api/v1/templates/send`      | WRITE      | Queue email from template (editable subject/body) |
| `GET`    | `/api/v1/templates`           | READ       | Paginated templates                               |
| `GET`    | `/api/v1/templates/sends`     | READ       | Paginated send history                            |
| `GET`    | `/api/v1/templates/sends/:id` | READ       | One send record                                   |
| `GET`    | `/api/v1/templates/:id`       | READ       |                                                   |
| `PATCH`  | `/api/v1/templates/:id`       | WRITE      |                                                   |
| `DELETE` | `/api/v1/templates/:id`       | ALL        |                                                   |

Send body: `templateId`, `recipientType`, `userId` **or** `organizationId`, optional `subject`, optional `content`.

Missing person/org email → `400`. Delivery uses existing Resend + BullMQ mail queue; `dispatchId` on the job updates status.

## 4. Acceptance

| #   | Case                         | Expected                                |
| --- | ---------------------------- | --------------------------------------- |
| 1   | ADMIN creates template       | markdown `content` stored               |
| 2   | Duplicate title              | `409`                                   |
| 3   | Send to user with email      | `EmailDispatch` QUEUED then SENT/FAILED |
| 4   | Send to org without email    | `400` organization_email_missing        |
| 5   | List sends                   | Paginated history                       |
| 6   | Non-admin without permission | `403`                                   |

## 5. Seed

`prisma/seeds/template.seed.ts` reads `../asman-dashboard/src/data/letterTemplates.json` (override via `ASMAN_DASHBOARD_TEMPLATES_PATH`).

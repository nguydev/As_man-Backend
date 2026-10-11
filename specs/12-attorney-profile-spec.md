# Attorney Profile Spec

- Attorney list supports `?page=&limit=&search=&language=` (search matches name/email/phone/bar/circuit; language filters `languageProficiencies`).
- Attorney profiles store name, email, phone/fax, website/linkedin, bar license number, federal circuit, address, experience, languages, specialties, geo lists (`states` / `courts` / `districts`), and professional summary.
- Imported attorneys may also carry `courtListenerId`, remote case stats (`remoteTotalCases`, `remoteWonCases`, `remoteLostCases`, `remotePendingCases`, `remoteWinRate`), `lastCaseDate`, and `lastImportedAt`.
- Local platform case counts remain separate: list/get responses expose `totalCases` / `winCases` from our `Case` table, while `remote*` fields mirror the Attorney Automation API.
- Attorneys are standalone admin-managed records and do not create user accounts or credentials.
- Avatar support uses the optional `Attorney.avatarUrl` field.
- Attorney and case reads return `avatarUrl` directly from the attorney record.

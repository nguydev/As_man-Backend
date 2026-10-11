# User Management Spec

- Platform admins and maintainers with `system.user` read permission can list users with cursor or offset pagination and filter by role, status, or a name/email/phone search term.
- Platform admins and maintainers with `system.user` read permission can read a non-deleted user by ID.
- Platform admins and maintainers with `system.user` write permission can set a user to `ACTIVE`, `BANNED`, `RESTRICTED`, or `SUSPENDED` through one status endpoint.
- Banning, restricting, and suspending require a reason, revoke all sessions, blacklist active access tokens, and invalidate cached authorization.
- Reactivating clears the previous restriction reason.
- Administrators and maintainers cannot restrict, suspend, ban, or delete their own account.
- Deleting a user requires full `system.user` permission, performs a soft delete, and immediately revokes all sessions.
- Authenticated users can update their own profile name, avatar URL, and optional address. The address is created or updated atomically with the profile.
- Email, phone, and password changes remain in the verified auth flows.

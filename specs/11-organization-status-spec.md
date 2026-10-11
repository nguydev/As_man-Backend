# Organization Status Spec

- New organizations default to `PENDING`.
- Platform organization administrators can activate, reject, suspend, or return an organization to pending review.
- Rejection and suspension require a reason; activation records the approving user.
- `OrganizationRolesGuard` authorizes routes only when both the user and organization are active.
- Non-admin organization lists exclude pending, rejected, and suspended organizations.
- Every status change queues an email to the organization email, falling back to the active owner's email when needed.

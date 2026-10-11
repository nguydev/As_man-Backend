# Address Contract Spec

- Organization creation accepts optional `region` and nested `address` fields.
- Address fields are optional and reusable through `AddressDto`.
- Organization create and list responses include `address`, or `null` when absent.
- Deleting an organization cascades to its owned address.

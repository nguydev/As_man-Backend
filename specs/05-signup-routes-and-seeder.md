READ `AGENTS.md` on project root.

## ORGANIZATION SIGNUP

Its a route for organizations to sign up. they can sign up with the details given below.
{
"name": "",
"email": "",
"organizationName": "",
"password": ""
}

this is it for now and all the fields are required
suggested route POST /signup/organization`

## DRIVERS SIGNUP

Its a route for drivers to sign up. they can sign up with the details given below.
{
"name": "",
"email": "",
"password": "",
"vinNumber": "",
"licensePlate": ""
}

All the fields are required.
suggested route POST /signup/driver

## SEEDER

create a seeder for the admin user. and for other users as well
create saparate files for all the seeder cause in production we will only seed the admin user

add a seeder file for running the seeder
and we will seed using `pnpm prisma db seed`

## IMPLEMENTATION

- `POST /api/v1/auth/signup/organization` creates the owner and organization.
- `POST /api/v1/auth/signup/driver` creates the driver account.
- `pnpm prisma db seed` seeds all fixtures.
- `pnpm prisma db seed -- --admin-only` seeds only the admin user.
- `SEED_ADMIN_PASSWORD` is required.

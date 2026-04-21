# Super Admin Bootstrap

`access_role` is the canonical authorization role
(`super_admin | admin | user`). Only an existing `super_admin` can
promote another user via the API
(`POST /api/admin/users?action=set-access-role`). Bootstrapping the
very first `super_admin` therefore has to happen out-of-band, against
the database.

## Prerequisites

1. The `ROLE_UNIFICATION_MIGRATION.sql` migration has been applied so
   that `user_profiles.access_role` is populated.
2. A `user_profiles` row already exists for the target email (create
   one through Settings / normal signup first).
3. You have `psql` access to the Neon database
   (`NEON_DATABASE_URL` in `.env`).

## Run the bootstrap

```bash
psql "$NEON_DATABASE_URL" \
  -v target_email="'person@example.com'" \
  -f scripts/bootstrap-super-admin.sql
```

The script:

- Looks up the user by lower-cased email.
- Sets `access_role = 'super_admin'` and ensures `status = 'Active'`.
- Is idempotent — rerunning it is a no-op on an already-promoted user.
- Fails loudly if the email is not found.

## After bootstrap

The promoted user can now call
`POST /api/admin/users?action=set-access-role` with
`{ "userId": "...", "accessRole": "super_admin" | "admin" | "user" }`
to promote/demote anyone else. No further out-of-band work is needed.

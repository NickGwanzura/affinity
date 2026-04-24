# Migrations

Schema changes for the Affinity Logistics CRM Neon/Postgres database.
One-way, ordered, tracked.

## How it works

- Every migration lives in this directory with the filename pattern
  `NNNN_<kebab-case-name>.sql`, where `NNNN` is a zero-padded 4-digit
  sequence number (`0001`, `0002`, ...). Files are applied in lexical
  order, which matches numeric order thanks to the padding.
- `0000_schema-migrations.sql` creates the tracker table
  `public.schema_migrations (filename, checksum, applied_at)` that records
  every applied file by SHA-256 of its contents.
- `scripts/migrate.ts` reads this directory, diff-checks against the
  tracker table, and applies any pending migrations in order. Each
  migration runs in a single `pool.query()` call so multi-statement and
  `DO $$ ... $$` blocks are supported.

To run against a live database:

```bash
NEON_DATABASE_URL='postgres://...' npm run db:migrate
```

The runner is idempotent — already-applied migrations are skipped by
filename. On a fresh database, `0000` is bootstrapped first so the
tracker table exists before the diff.

## Adding a new migration

1. Pick the next unused sequence number (`ls migrations/ | tail`).
2. Create `migrations/NNNN_my-change.sql` with the DDL. Wrap
   destructive or ordered statements in a `BEGIN; ... COMMIT;` block.
   Prefer idempotent constructs (`CREATE TABLE IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so reruns
   during development are safe.
3. Commit the file alongside the code that needs it.
4. `npm run db:migrate` to apply locally; deploy and repeat in
   staging/prod as usual.

## Marking a migration as already applied

For databases where a migration was run manually before this system
existed, record it without re-executing:

```sql
INSERT INTO public.schema_migrations (filename, checksum)
VALUES ('0005_financial-tables.sql', '<sha256>')
ON CONFLICT DO NOTHING;
```

Compute the checksum with `shasum -a 256 migrations/0005_financial-tables.sql`.

## Never edit applied migrations

Once a migration is merged to `main`, treat it as immutable. Schema
corrections go in a new numbered file; the checksum mismatch on an old
file is a signal that something is wrong, not a thing to fix.

## `archive/`

`migrations/archive/` holds one-off fixes, personal password resets,
diagnostic scripts (`DATABASE_VERIFICATION.sql`, etc.), and superseded
migrations (`FORENSIC_FIX_MIGRATION.sql` v1, replaced by v2). They are
kept for historical reference only and are **not** executed by the
runner — the filename regex (`^\d{4}_.+\.sql$`) excludes them.

# Neon Migration Guide

## Current Runtime Architecture

```text
React + Vite frontend
  -> /api serverless routes
  -> Neon PostgreSQL
```

Authentication is handled in the API layer with JWTs signed by `JWT_SECRET`.

## Environment

```bash
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET=replace-with-a-strong-random-secret
APP_BASE_URL=https://your-app.example.com
VITE_API_URL=/api
```

## Database Setup

1. Create a Neon project and copy the connection string.
2. Apply the repo migrations:

```bash
psql "$NEON_DATABASE_URL" -f API_SECURITY_MIGRATION.sql
psql "$NEON_DATABASE_URL" -f REGISTRATION_REQUESTS_MIGRATION.sql
```

3. Confirm the core tables exist:

- `user_profiles`
- `password_resets`
- `vehicles`
- `clients`
- `quotes`
- `quote_items`
- `invoices`
- `invoice_items`
- `payments`
- `receipts`
- `expenses`
- `employees`
- `payslips`
- `invites`
- `registration_requests`
- `company_details`

## Validation Checklist

- `NEON_DATABASE_URL` is set in the server environment.
- `JWT_SECRET` is set in the server environment.
- API routes can connect to the database.
- `npm run build` succeeds.
- Login, invite acceptance, and password reset flows work against the deployed environment.

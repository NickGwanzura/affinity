# Security Refactor Guide

## Current Security Baseline

- Browser code talks only to `/api` routes.
- Database access is server-side only through Neon.
- JWT signing and verification use `JWT_SECRET` only.
- Protected routes enforce bearer-token auth and role checks.
- Auth and CRUD endpoints validate input with Zod.
- Password reset requests are stored in `password_resets` and delivered through SMTP.

## Required Environment

```bash
NEON_DATABASE_URL=postgresql://user:password@host/database?sslmode=require
JWT_SECRET=replace-with-a-strong-random-secret
APP_BASE_URL=https://your-app.example.com

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer@example.com
SMTP_PASS=replace-with-smtp-password
SMTP_FROM="Affinity Logistics <no-reply@example.com>"
SMTP_REPLY_TO=support@example.com

VITE_API_URL=/api
```

## Auth Endpoints

- `POST /api/auth?action=login`
- `POST /api/auth?action=change-password`
- `POST /api/auth?action=forgot-password`
- `POST /api/auth?action=reset-password`
- `GET /api/auth?action=me`

`POST /api/auth?action=register` is intentionally disabled and returns `403 Registration disabled`.

## Database Migrations

Run:

```bash
psql "$NEON_DATABASE_URL" -f API_SECURITY_MIGRATION.sql
psql "$NEON_DATABASE_URL" -f REGISTRATION_REQUESTS_MIGRATION.sql
```

## Operational Notes

- Password reset emails require the SMTP variables above in every deployed environment.
- `APP_BASE_URL` should point at the user-facing application URL so reset links resolve correctly.
- `npm run build` is the primary repo-level verification command in this project.

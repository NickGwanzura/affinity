# Affinity Logistics Management System

Affinity is an internal logistics and finance operations app for vehicle movement, landed-cost tracking, billing, receipts, statements, payroll, and document generation.

## Current Stack

- React 19 + TypeScript + Vite
- Vercel serverless API routes
- Neon PostgreSQL for operational data
- JWT authentication handled server-side
- Browser-side PDF generation with `jspdf`

## Core Product Areas

- Vehicle and fleet operations
- Driver portal and expense capture
- Quotes, invoices, receipts, payments, and client statements
- Employee and payslip management
- Company settings and branded document output

## Run Locally

Prerequisites:

- Node.js 18+

Install and start:

```bash
npm install
npm run dev
npm run dev:api
```

Production build:

```bash
npm run build
```

## Environment

Server runtime:

- `NEON_DATABASE_URL`
- `JWT_SECRET`
- `APP_BASE_URL` for invite and password reset links

Password reset email delivery:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_REPLY_TO` optional

Client runtime:

- `VITE_API_URL` optional, defaults to `/api`

## Observability

Both the API server and the browser bundle ship with optional structured
logging and error reporting that degrade gracefully when no DSN is configured:

- The backend uses [`pino`](https://getpino.io) (`api/_logger.ts`). In dev it
  pretty-prints to stdout; in production it emits JSON suitable for log
  aggregators. Password / token / cookie fields are redacted automatically.
- The browser uses a thin `console`-backed logger (`utils/logger.ts`) so the
  client bundle stays small. Minimum level is controlled by `VITE_LOG_LEVEL`.
- Sentry capture (`api/_sentry.ts`, `utils/sentry.ts`) only initialises when
  `SENTRY_DSN` (server) or `VITE_SENTRY_DSN` (browser) is set. With no DSN the
  init and `captureException` calls are no-ops, so local dev and unconfigured
  deploys continue to work unchanged. Only basic exception capture is enabled —
  no profiling, replay, or session tracking.

Set `LOG_LEVEL` (server) and `VITE_LOG_LEVEL` (browser) to one of
`debug | info | warn | error` to override the defaults.

## Notes

- Apply the SQL migrations in the repo, including `API_SECURITY_MIGRATION.sql` and `REGISTRATION_REQUESTS_MIGRATION.sql`, to the active Neon database.
- There is currently no automated test suite wired into `package.json`, so `npm run build` is the main repo-level verification step.

# Affinity Logistics Management System

Affinity is an internal logistics and finance operations app for vehicle movement, landed-cost tracking, billing, receipts, statements, payroll, and document generation.

## Current Stack

- React 19 + TypeScript + Vite
- Neon PostgreSQL for operational data
- Browser-side PDF generation with `jspdf`
- A mixed auth layer that is being consolidated around the in-app auth service

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
```

Production build:

```bash
npm run build
```

## Environment

The app expects a Neon connection string in the client environment:

- `VITE_NEON_DATABASE_URL`

The current auth flow also uses:

- `VITE_JWT_SECRET`

Some legacy service paths still reference Supabase client configuration, so keep these available until the auth layer is fully unified:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Notes

- PDF branding and finance flows depend on the SQL migrations in the repo being applied to the active Neon database.
- There is currently no automated test suite wired into `package.json`, so `npm run build` is the main repo-level verification step.

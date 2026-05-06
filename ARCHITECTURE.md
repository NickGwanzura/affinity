# Architecture

Affinity Logistics CRM — cross-border vehicle logistics for the SADC region. Single canonical doc; supersedes the 30+ historical audit reports under `docs/archive/`.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind v4 (`@theme` tokens in `styles/app.css`), lucide-react icons, Geist Sans |
| API | Express route handlers in `api/*.ts`, mounted by `server.ts` and hosted on Railway |
| Database | Neon PostgreSQL via `@neondatabase/serverless` — raw SQL, no ORM |
| Auth | Custom JWT (no OAuth), bcrypt cost factor 12, legacy SHA-256 auto-upgrade |
| Email | Resend + `@react-email/components` templates in `api/emails/*.tsx` |
| Deploy | Railway (`railway.json` + `Dockerfile`); pushing to `main` triggers a GitHub-hook deploy |
| Observability | `pino` logger (server) + browser logger; optional Sentry (`SENTRY_DSN` / `VITE_SENTRY_DSN` no-op when unset) |
| Testing | Vitest + happy-dom + Testing Library |

## Folder shape

```
api/                  # serverless route handlers + shared middleware
  _middleware.ts      # verifyToken, requireAccessRole, requirePasswordCurrent, CORS, security headers
  _auth.ts            # bcrypt + JWT + reset-token logic
  _db.ts              # neon() + Pool singleton + withTransaction
  _schemas.ts         # Zod schemas (single source of truth for request + response shapes)
  _audit.ts           # logAuditEvent — writes to audit_logs with redaction
  _email.tsx          # transactional dispatch via Resend
  _idempotency.ts     # withIdempotency wrapper for money-mutating POSTs
  _logger.ts          # pino server logger
  _sentry.ts          # @sentry/node init (no-op without DSN)
  _rate_limit.ts      # in-memory Map; switches to Upstash Redis when env present
  emails/             # @react-email templates
components/           # React components — top-level pages + ui primitives + shared modals
  ui/                 # Button, Modal, StatusBadge, DashboardKpiCard, DashboardSection, ...
  shared/             # ConfirmModal, FormModal, QuoteModal, InvoiceModal, PaymentModal, ...
  settings/           # Per-tab files extracted from Settings.tsx shell
  client-directory/   # Per-section files extracted from ClientDirectory.tsx shell
  financials/         # FinancialsShell + sections + utils
  admin/              # AdminDashboard tabs (Vehicles, Reports, Employees, Payslips, ...)
  accountant/         # AccountantDashboard tabs
contexts/             # React context providers (SessionContext)
services/             # Frontend data layer
  apiClient.ts        # Single fetch choke-point; JWT injection; APIError class
  authService.ts      # Session bootstrap + login/logout
  dataService.ts      # Typed facades over apiClient (~160 call sites)
  pdfService.ts       # PDF generation (statically heavy; lazy-loaded at click handlers)
utils/                # Browser logger, Sentry init, validation helpers
hooks/                # useToast etc.
migrations/           # Numbered SQL migrations (NNNN_name.sql) + migrate.ts runner
scripts/              # One-shot ops scripts (broadcast email, super-admin bootstrap)
tests/                # Vitest suites mirroring source structure
docs/archive/         # Historical audit reports — do not link from new docs
```

## Auth model

- **`access_role`** is canonical: `super_admin` | `admin` | `user`. Every authorization check uses this column.
- **`role`** is display-only (e.g. "Accountant", "Driver"). Never read it for auth — the unification migration documents this.
- Every authenticated route chains: `setSecurityHeaders` → `handleCors` → `verifyToken` → `requirePasswordCurrent` → `requireAccessRole(['super_admin','admin','user'])`. Reads use the wide tier; writes use `['super_admin','admin']`; super-admin-only uses `['super_admin']`.
- **`force_password_change`** is server-enforced via `requirePasswordCurrent`. Admin-created users get this flag set.
- Reset tokens: 1h expiry, single-use via `used_at`, 5-attempt invalidation via per-token counter.
- Bootstrap a super_admin via `scripts/bootstrap-super-admin.sql` (see `SUPER_ADMIN_BOOTSTRAP.md`).

## Data layer conventions

- Frontend MUST go through `services/apiClient.ts`. Direct `fetch` is forbidden — grep enforces it.
- `apiClient` returns `Promise<T>` typed via `z.infer` from `_schemas.ts`. No `PaginatedResponse<any>`.
- Backend uses `sql\`...\`` tagged templates from `@neondatabase/serverless`. `sql.unsafe` is allow-listed only for sortBy / sortOrder via switch statements.
- Transactions go through `withTransaction()` (singleton `Pool`). Money-mutating writes always wrap in a transaction.
- DB is `snake_case`; TypeScript is `camelCase` at the consumer boundary. Mappings happen in `apiClient` typed shells — no drift.

## Migration discipline

- Every schema change lands as `migrations/NNNN_name.sql` with a 4-digit prefix. Example: `migrations/0035_idempotency-keys.sql`.
- Apply with `npm run db:migrate` (`scripts/migrate.ts`). The runner reads `schema_migrations` to skip already-applied files.
- **Never edit an applied migration**. To change a schema, write a new migration.
- One-off fixes go to `migrations/archive/`. Diagnostic-only SQL goes there too.
- Archived migrations are reference-only; do not re-run.

## API conventions

- REST-ish with `?action=...` for sub-actions on the same route (e.g. `POST /api/auth?action=login`). Documented as canonical here; do not try to pure-REST it.
- Schema validation: every POST/PUT body is parsed via Zod from `_schemas.ts`. If the schema doesn't include a field, the field is silently stripped — extend the schema explicitly.
- Audit logging: every CRUD mutation calls `logAuditEvent` from `_audit.ts`. Old row fetched before UPDATE/DELETE so `oldData` is real.
- Idempotency: money-mutating POSTs (`/invoices`, `/payments`, `/receipts`) accept an optional `Idempotency-Key` header. Header absent = original behavior.
- Errors: `apiError(res, status, message, details?)`. NEVER include `error.stack` in the response — log server-side only.
- Rate limits: login + forgot-password + reset-password + ai are gated. The limiter is in-memory by default (per process); set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to enforce across instances.

## Design system

- Primary brand: amber `#D97706` (Carbon Blue removed in this session).
- Sidebar: warm-black `#1C1917` with amber active dot + amber icon tint.
- Square corners only. Exceptions: `rounded-full` for avatars/dots, `rounded-sm` for tagged badges.
- Page bg: `#F9F9F8` warm off-white.
- Tokens live in `styles/app.css` `@theme` block. Use `bg-primary`, `text-secondary`, `border-subtle` etc. — don't hardcode hex.
- Dashboards use the trio: `<DashboardPageHeader>` + `<DashboardKpiCard>` grid + `<DashboardSection>` wrapper. Pages without metrics skip the KPI grid.

## Environment

| Var | Required | Notes |
|---|---|---|
| `NEON_DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | JWT signing key |
| `RESEND_API_KEY` | yes (for email) | Resend transactional |
| `EMAIL_FROM_ADDRESS` | yes (for email) | Sending domain MUST be Resend-verified |
| `APP_BASE_URL` / `PUBLIC_APP_URL` | yes | Used in email links + CORS allowlist |
| `ALLOWED_ORIGINS` | optional | CORS allowlist (defaults to localhost dev) |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | optional | Error capture; no-op when unset |
| `LOG_LEVEL` / `VITE_LOG_LEVEL` | optional | Default `info` server, `warn` browser |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | optional | Distributed rate limit; fallback in-memory |
| `DEV_EXPOSE_RESET_TOKEN=1` | dev only | Echo reset tokens in HTTP response |
| `GEMINI_API_KEY` | optional | AI endpoint |

## Testing

- Vitest + happy-dom for browser-side unit tests; pure-Node for API helpers.
- `npm test` watches; `npm run test:run` runs once; `npm run test:coverage` writes HTML coverage.
- Tests are unit-scope and fast — no real DB, no real Resend. Mock external IO with `vi.mock`.
- First batch (added 2026-04) covers: client balance math, auth (bcrypt + legacy + JWT + reset-token), Zod schemas, migration runner, payment allocations, money formatters.

## Anti-patterns to avoid

- **Don't migrate to an ORM** (Drizzle/Prisma). Raw SQL with transactions works; the pain isn't query syntax, it's coverage.
- **Don't introduce Redux/Zustand**. `SessionContext` + lightweight hooks cover the shared state we have.
- **Don't add more audit MDs at repo root**. One living `ARCHITECTURE.md` (this file) + ADRs under `docs/decisions/NNNN-*.md`.
- **Don't bypass `apiClient.ts`** with raw `fetch`. Grep CI enforces this.
- **Don't read `role` for authorization**. `access_role` is canonical; `role` is a display label.
- **Don't return `error.stack` to clients**. `console.error` server-side only.
- **Don't reintroduce `@carbon/*`**. Removed this session; the look is preserved via Tailwind tokens.
- **Don't move PDF generation server-side just for bundle size**. It's lazy-loaded at click handlers; 0KB cost on first paint.

## Operational runbook

- **Cut a release**: push to `main`. Railway's GitHub hook redeploys.
- **Force a fresh deploy**: `railway up` (uploads local filesystem; supersedes hook).
- **Run migrations**: `npm run db:migrate` (idempotent — only pending files apply).
- **Rotate a user's password as admin**: Settings → Users tab → "Set Password" (forces `force_password_change=true` on next login).
- **Broadcast an announcement email**: `tsx scripts/send-maintenance-announcement.tsx --dry-run` then drop `--dry-run`.
- **Promote a super-admin**: `psql $NEON_DATABASE_URL -v target_email="'user@example.com'" -f scripts/bootstrap-super-admin.sql`.

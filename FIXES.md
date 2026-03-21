# Affinity — Fix Plan

Generated: 2026-03-15

---

## Priority 1 — Critical / Security

### 1. Remove hard-coded JWT secret fallback
**File:** `services/authService.ts`
- Replace `'your-secret-key-change-in-production'` fallback with a hard error if `VITE_JWT_SECRET` is not set
- Ensure `.env.example` documents the required var

### 2. Move database queries server-side
**Files:** `services/databaseService.ts`, `services/neonClient.ts`
- Direct SQL from the browser exposes DB schema and connection credentials to clients
- Create a `/api` route layer (Vercel serverless functions or a lightweight Express server)
- Move all `databaseService` functions behind API endpoints
- Browser should only call fetch() — never raw SQL

### 3. Enable Row-Level Security (RLS)
**Database:** Neon PostgreSQL
- Enable RLS on all tables (vehicles, expenses, invoices, payslips, clients, employees, etc.)
- Write RLS policies per role (admin sees all, driver sees own rows, etc.)
- This makes access control enforced at the DB level, not just app logic

---

## Priority 2 — Architecture / Auth Migration

### 4. Complete Supabase → Neon auth migration
**Files:** `services/supabaseService.ts`, `services/authService.ts`, `services/neonAuthService.ts`
- Three auth services coexist — consolidate to one: `authService.ts` (Neon-based)
- Remove or clearly stub out `supabaseService.ts` once all its usages are replaced
- Audit all `import ... from './supabaseService'` references and migrate each

### 5. Break up monolithic components
**Files:**
- `components/AdminDashboard.tsx` (2,647 LOC) → split into: `VehiclesTab`, `ExpensesTab`, `EmployeesTab`, `PayslipsTab`, `OperatingFundsTab`
- `components/Financials.tsx` (1,979 LOC) → split into: `InvoicesTab`, `QuotesTab`, `PaymentsTab`, `ReceiptsTab`, `StatementsTab`
- `components/Settings.tsx` (1,764 LOC) → split into: `CompanySettings`, `UserManagement`, `InviteSettings`

---

## Priority 3 — Quality / Maintainability

### 6. Add ESLint + Prettier
- Add `.eslintrc.json` with `eslint-plugin-react`, `@typescript-eslint`
- Add `.prettierrc`
- Add `lint` and `format` scripts to `package.json`

### 7. Dynamic exchange rates
**File:** `constants.ts`
- Replace static exchange rate constants with a fetch from an exchange rate API (e.g. Open Exchange Rates)
- Cache rates in localStorage with a TTL (e.g. 24h)

### 8. Fix Gemini AI integration
**File:** `services/geminiService.ts`
- Currently returns hard-coded placeholder text
- Move API call to a server-side function (fixes the key exposure problem too)
- Wire up real AI insights in AccountantDashboard

### 9. Add a basic test suite
- Add Vitest (already using Vite — zero-config setup)
- Start with unit tests for: `authService`, `databaseService` pure functions, PDF generation helpers
- Add `test` script to `package.json`

### 10. Offload PDF generation from UI thread
**File:** `services/pdfService.ts`
- Large document generation blocks the browser
- Move jsPDF calls into a Web Worker
- Show a loading spinner while generation runs in background

---

## Quick Wins (< 30 min each)

- [ ] Add `VITE_JWT_SECRET` to `.env.example` with instructions
- [ ] Add error if required env vars are missing at startup (`vite.config.ts` define check)
- [ ] Rename `supabaseService.ts` → `supabaseService.legacy.ts` to signal it's deprecated
- [ ] Add `// TODO: migrate to API route` comments on all direct Neon queries in components
- [ ] Remove `console.log` debug statements left in production code

---

## Order of Attack Tomorrow

1. JWT secret hard error (30 min)
2. ESLint + Prettier setup (45 min)
3. Start Supabase → Neon auth consolidation (2–3 hrs)
4. Scaffold `/api` routes for one service (e.g. vehicles) as proof-of-concept (2 hrs)
5. Split AdminDashboard into tab components (2 hrs)

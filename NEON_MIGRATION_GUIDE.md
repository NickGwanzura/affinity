# Supabase to Neon Database Migration Guide

## Migration Summary

**Date:** January 2026  
**Scope:** Database layer migration from Supabase to Neon PostgreSQL

---

## Architecture After Migration

```
┌─────────────────────────────────────────────────────────────┐
│                    Affinity CRM                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────────┐     ┌─────────────────────────┐   │
│   │   SUPABASE          │     │       NEON              │   │
│   │   (Auth Only)       │     │   (All Database)        │   │
│   ├─────────────────────┤     ├─────────────────────────┤   │
│   │ • signUp            │     │ • vehicles              │   │
│   │ • signIn            │     │ • expenses              │   │
│   │ • signOut           │     │ • quotes / quote_items  │   │
│   │ • getSession        │     │ • invoices / inv_items  │   │
│   │ • resetPassword     │     │ • payments              │   │
│   │ • updateUser        │     │ • clients               │   │
│   │ • admin.deleteUser  │     │ • user_profiles         │   │
│   └─────────────────────┘     │ • employees             │   │
│                               │ • payslips              │   │
│                               │ • invites               │   │
│                               │ • company_details       │   │
│                               │ • registration_requests │   │
│                               └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `services/neonClient.ts` | **NEW** | Neon database connection client |
| `services/databaseService.ts` | **NEW** | All database operations using Neon SQL |
| `services/supabaseService.ts` | **MODIFIED** | Delegates DB to Neon, keeps Auth |
| `services/supabaseClient.ts` | **MODIFIED** | Added documentation comment |
| `.env` | **MODIFIED** | Added VITE_NEON_DATABASE_URL |
| `package.json` | **MODIFIED** | Added @neondatabase/serverless |

---

## Environment Variables

```env
# SUPABASE - RETAINED FOR AUTH ONLY
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# NEON - PRIMARY DATABASE
VITE_NEON_DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
```

---

## Setting Up Neon

### 1. Create Neon Account
1. Go to https://console.neon.tech
2. Create a new project
3. Copy the connection string

### 2. Import Schema
Export your schema from Supabase and import into Neon:

```bash
# Export from Supabase
pg_dump -h db.your-project.supabase.co -U postgres -d postgres --schema-only > schema.sql

# Import to Neon
psql "postgresql://user:password@host.neon.tech/database?sslmode=require" < schema.sql
```

### 3. Migrate Data
```bash
# Export data from Supabase
pg_dump -h db.your-project.supabase.co -U postgres -d postgres --data-only > data.sql

# Import to Neon
psql "postgresql://user:password@host.neon.tech/database?sslmode=require" < data.sql
```

### 4. Configure Environment
Add your Neon connection string to `.env`:
```
VITE_NEON_DATABASE_URL=postgresql://user:password@host.neon.tech/database?sslmode=require
```

---

## Database Tables (Schema Reference)

All these tables must exist in Neon with the same schema as Supabase:

| Table | Description |
|-------|-------------|
| `vehicles` | Vehicle inventory |
| `expenses` | Vehicle and operational expenses |
| `quotes` | Customer quotes |
| `quote_items` | Line items for quotes |
| `invoices` | Customer invoices |
| `invoice_items` | Line items for invoices |
| `payments` | Payment records |
| `clients` | Customer/client database |
| `user_profiles` | User profile data (linked to Supabase Auth) |
| `employees` | Employee records |
| `payslips` | Payroll records |
| `invites` | User invitation system |
| `company_details` | Company configuration |
| `registration_requests` | Self-registration requests |

---

## Access Control Migration

### Supabase RLS (Removed)
Previously, Row Level Security policies controlled access:
- `Allow authenticated read access`
- `Allow authenticated insert access`
- `Allow authenticated update access`

### Neon (Application-Level Enforcement)
Access control is now enforced in the application layer:
- User authentication via Supabase Auth (JWT validation)
- User ID extracted from session and passed to queries
- Application logic enforces permissions based on user role

**Important:** All queries should include appropriate WHERE clauses for user/tenant filtering when needed.

---

## Connection Pooling

Neon serverless driver handles connection pooling automatically:
- `neonConfig.fetchConnectionCache = true` enables connection caching
- No manual connection management required
- Automatic retry and reconnection

---

## Validation Checklist

- [ ] Neon connection string configured in `.env`
- [ ] All tables created in Neon database
- [ ] Data migrated from Supabase
- [ ] Application boots successfully
- [ ] CRUD operations work (vehicles, expenses, quotes, invoices)
- [ ] User authentication works (via Supabase Auth)
- [ ] User profile CRUD works (via Neon)
- [ ] No Supabase DB calls remain (all `.from()` replaced)

---

## Rollback Procedure

If issues occur, you can rollback:

1. Revert `services/supabaseService.ts` to use Supabase for DB
2. Remove `services/neonClient.ts` and `services/databaseService.ts`
3. Update `.env` to remove Neon URL
4. Remove `@neondatabase/serverless` from package.json

---

## Features Retained in Supabase

| Feature | Status | Notes |
|---------|--------|-------|
| Auth | ✅ Retained | signUp, login, session, password reset |
| Database | ❌ Removed | Migrated to Neon |
| Storage | N/A | Not used in this project |
| Realtime | N/A | Not actively used |
| Edge Functions | N/A | Not used |

---

## Support

For issues related to:
- **Neon Database**: https://neon.tech/docs
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **Application**: Check console logs for `[NEON]` or `[SUPABASE]` prefixes

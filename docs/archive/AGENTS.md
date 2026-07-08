# Agent Guidelines for Affinity Logistics CRM

**Last Updated:** 2026-07-08

---

## Current Frontend Direction

Carbon has been removed. Do **not** add `@carbon/react`, `@carbon/icons-react`, `var(--cds-*)` tokens, or Carbon component patterns back into this project.

The app now uses Tailwind utilities, local UI wrappers, and the design tokens in `styles/app.css`.

---

## Design System

### Tokens

Use the Tailwind theme tokens defined in `styles/app.css`:

```css
/* Brand */
bg-primary
hover:bg-primary-hover
text-primary
border-primary

/* Text */
text-text-primary
text-text-secondary
text-text-muted
text-text-subtle

/* Surfaces */
bg-surface
bg-surface-muted
bg-surface-subtle

/* Borders */
border-border-subtle
border-border-default
border-border-strong

/* Semantic */
text-success
bg-success-soft
text-danger
bg-danger-soft
text-warning
bg-warning-soft
text-info
bg-info-soft
```

Hardcoded hex values should be avoided unless there is already a nearby established exception.

### Brand

- Primary brand color: amber `#D97706` through `bg-primary` / `text-primary`.
- Sidebar: warm-black `#1C1917` tokens from `styles/app.css`.
- Base font: General Sans in `styles/app.css`.
- Radius is allowed where the local UI system already uses it (`rounded-sm`, `rounded-md`, `rounded-lg`). Keep it consistent and restrained.

---

## Component Patterns

### UI Wrappers

Check `components/ui/` before building a new primitive:

```
components/ui/
├── Button.tsx
├── DashboardCard.tsx
├── DataTableWrapper.tsx
├── DashboardPageHeader.tsx
├── DashboardKpiCard.tsx
├── DashboardSection.tsx
├── EmptyState.tsx
├── FormInputs.tsx
├── Modal.tsx
├── OverflowMenu.tsx
├── Skeleton.tsx
├── StatusBadge.tsx
└── Tabs.tsx
```

Prefer these wrappers when they fit. If a feature already has a local pattern, match the surrounding file instead of introducing a competing style.

### Buttons

Use `components/ui/Button.tsx` for new button work where practical. Raw `<button>` is acceptable for small table/menu affordances, but keep focus states, disabled states, and spacing consistent.

### Forms

Use `TextInput`, `TextArea`, `Select`, `Checkbox`, and related helpers from `components/ui/FormInputs.tsx` where practical.

### Tables

Use `DataTableWrapper` for new standard CRUD tables. Existing feature-specific raw tables are allowed, especially when they have mobile card behavior, but avoid introducing a third table style.

### Icons

Use `lucide-react`, which is the current icon dependency.

---

## Engineering Rules

- Keep API access through `services/apiClient.ts` or existing service wrappers. Do not bypass with ad hoc internal `fetch` calls.
- Keep raw SQL. Do not introduce Prisma, Drizzle, Redux, or Zustand without an explicit architecture decision.
- `access_role` is canonical for authorization. `role` is a business/display role.
- Do not return `error.stack` to clients. Log details server-side only.
- Mutating financial endpoints should preserve idempotency and audit logging patterns.
- Tests should stay unit-scope and avoid real DB, Resend, or external network calls.

---

## Validation Before Handoff

Run the relevant subset first, then the full checks when the change touches shared behavior:

```bash
npx tsc --noEmit
npm run test:run
npm run lint
npm run build
```

If one of these cannot be run, note it clearly in the final response.

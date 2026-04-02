# Agent Guidelines for Affinity Logistics CRM

**Last Updated:** 2026-04-02  
**Carbon Version:** @carbon/react ^1.103.0

---

## Quick Reference

### Carbon Design System - DO's and DON'Ts

| ✅ DO | ❌ DON'T |
|-------|----------|
| Use `var(--cds-*)` CSS custom properties | Use Tailwind colors like `bg-zinc-900`, `text-blue-600` |
| Use sharp corners (0 border-radius) | Use `rounded-lg`, `rounded-xl`, `rounded-full` |
| Use Carbon components from `@carbon/react` | Build custom components that duplicate Carbon |
| Use `@carbon/icons-react` for all icons | Use custom SVGs or icon libraries |
| Follow Carbon spacing scale | Use arbitrary Tailwind spacing values |

---

## Carbon Design Tokens Reference

### Colors
```css
/* Primary Actions */
var(--cds-interactive, #0f62fe)           /* Primary buttons, links */
var(--cds-interactive-hover, #0353e9)     /* Hover states */

/* Text */
var(--cds-text-primary, #161616)          /* Main text */
var(--cds-text-secondary, #525252)        /* Secondary text */
var(--cds-text-placeholder, #a8a8a8)      /* Placeholder text */
var(--cds-text-on-color, #ffffff)         /* Text on colored backgrounds */

/* Backgrounds */
var(--cds-layer-01, #ffffff)              /* Primary background */
var(--cds-layer-02, #f4f4f4)              /* Secondary background */
var(--cds-layer-hover, #e8e8e8)           /* Hover background */
var(--cds-field-01, #ffffff)              /* Input fields */

/* Borders */
var(--cds-border-subtle, #c6c6c6)         /* Subtle borders */
var(--cds-border-strong-01, #8d8d8d)      /* Strong borders */

/* Status/Semantic */
var(--cds-support-success, #24a148)       /* Success states */
var(--cds-support-error, #da1e28)         /* Error states */
var(--cds-support-warning, #f1c21b)       /* Warning states */
var(--cds-support-info, #0f62fe)          /* Info states */
```

### Typography
- **Font Family:** IBM Plex Sans (already configured in `app.css`)
- **Base Size:** 16px (1rem)
- **Weights:** 300 (light), 400 (regular), 600 (semibold)

### Spacing Scale
```css
$spacing-01: 2px   /* 0.125rem */
$spacing-02: 4px   /* 0.25rem */
$spacing-03: 8px   /* 0.5rem */
$spacing-04: 12px  /* 0.75rem */
$spacing-05: 16px  /* 1rem */
$spacing-06: 24px  /* 1.5rem */
$spacing-07: 32px  /* 2rem */
$spacing-08: 40px  /* 2.5rem */
$spacing-09: 48px  /* 3rem */
$spacing-10: 64px  /* 4rem */
```

---

## Common Patterns

### 1. Creating a Card
```tsx
import { Tile } from '@carbon/react';

// ✅ Correct - Uses Carbon Tile
<Tile style={{ padding: '1rem' }}>
  <h3 style={{ color: 'var(--cds-text-primary, #161616)' }}>Title</h3>
  <p style={{ color: 'var(--cds-text-secondary, #525252)' }}>Content</p>
</Tile>

// ❌ Incorrect - Custom div with Tailwind
<div className="bg-white p-4 rounded-lg shadow-sm">
  <h3 className="text-zinc-900">Title</h3>
</div>
```

### 2. Status Badges
```tsx
import { Tag } from '@carbon/react';

// ✅ Correct - Uses Carbon Tag
<Tag type="green" size="sm">Active</Tag>
<Tag type="red" size="sm">Error</Tag>
<Tag type="blue" size="sm">Info</Tag>
<Tag type="warm-gray" size="sm">Pending</Tag>

// Tag types available:
// 'red' | 'magenta' | 'purple' | 'blue' | 'cyan' | 'teal' | 'green' | 'gray' | 
// 'warm-gray' | 'cool-gray' | 'high-contrast' | 'outline'
```

### 3. Buttons
```tsx
import { Button } from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/icons-react';

// ✅ Correct - Uses Carbon Button
<Button kind="primary" renderIcon={Add}>Add Item</Button>
<Button kind="ghost" renderIcon={Edit} hasIconOnly iconDescription="Edit" />
<Button kind="danger" renderIcon={TrashCan}>Delete</Button>

// Button kinds: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger'
```

### 4. Form Inputs
```tsx
import { TextInput, TextArea, Select, SelectItem } from '@carbon/react';

// ✅ Correct - Uses Carbon form components
<TextInput
  id="name"
  labelText="Name"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

<TextArea
  id="description"
  labelText="Description"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>

<Select id="status" labelText="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
  <SelectItem value="active" text="Active" />
  <SelectItem value="inactive" text="Inactive" />
</Select>
```

### 5. Data Tables
```tsx
import { DataTableWrapper } from '../ui';

// ✅ Correct - Uses the DataTableWrapper component
const columns = [
  { key: 'name', header: 'Name', width: '30%' },
  { key: 'email', header: 'Email', width: '40%' },
  { key: 'status', header: 'Status', width: '20%' },
];

const rows = data.map(item => ({
  id: item.id,
  name: item.name,
  email: item.email,
  status: <Tag type={item.active ? 'green' : 'gray'} size="sm">{item.active ? 'Active' : 'Inactive'}</Tag>,
}));

<DataTableWrapper
  title="User List"
  description="Manage system users"
  rows={rows}
  columns={columns}
  onEdit={(row) => handleEdit(row)}
  onDelete={(row) => handleDelete(row)}
  search
/>
```

### 6. Modals
```tsx
import { Modal } from '@carbon/react';

// ✅ Correct - Uses Carbon Modal
<Modal
  open={isOpen}
  onRequestClose={() => setIsOpen(false)}
  modalHeading="Confirm Action"
  primaryButtonText="Confirm"
  secondaryButtonText="Cancel"
  onRequestSubmit={handleConfirm}
  danger={isDangerous}
>
  <p>Are you sure you want to proceed?</p>
</Modal>
```

---

## File Structure Guidelines

### UI Components Location
```
components/ui/
├── Button.tsx              # Carbon Button wrapper
├── DashboardCard.tsx       # Carbon Tile-based card
├── DataTableWrapper.tsx    # Carbon DataTable wrapper
├── StatusBadge.tsx         # Carbon Tag wrapper
├── StatCard.tsx           # Statistics card
├── Skeleton.tsx           # Loading skeletons
├── EmptyState.tsx         # Empty state component
└── index.ts               # Exports
```

### When Creating New Components
1. **Always check** if a Carbon component already exists
2. **Use the wrappers** in `components/ui/` when available
3. **Follow existing patterns** in similar components
4. **Use Carbon tokens** for all styling

---

## Migration Checklist

When working on existing files, check for:

- [ ] **Border radius:** Remove all `rounded-*` classes (except for avatar circles)
- [ ] **Colors:** Replace Tailwind colors with `var(--cds-*)` tokens
- [ ] **Backgrounds:** Replace `bg-white`, `bg-zinc-*` with `var(--cds-layer-*)`
- [ ] **Text colors:** Replace `text-zinc-*` with `var(--cds-text-*)`
- [ ] **Borders:** Replace `border-zinc-*` with `var(--cds-border-*)`
- [ ] **Shadows:** Remove `shadow-*` classes (Carbon uses minimal shadows)
- [ ] **Buttons:** Replace custom buttons with Carbon `Button`
- [ ] **Inputs:** Replace custom inputs with Carbon form components
- [ ] **Tables:** Replace HTML tables with `DataTableWrapper`
- [ ] **Status badges:** Replace custom badges with Carbon `Tag`

---

## Testing Changes

### Before Committing
```bash
# Build the project
npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Run linting
npm run lint
```

### Visual Testing
1. Test in both **light mode** (primary)
2. Check **focus states** (tab through elements)
3. Verify **mobile responsiveness**
4. Test **color contrast** for accessibility

---

## Common Mistakes to Avoid

### 1. Mixing Tailwind with Carbon
```tsx
// ❌ Don't do this
<div className="bg-white p-4 rounded-lg">
  <Button kind="primary">Save</Button>
</div>

// ✅ Do this instead
<Tile style={{ padding: '1rem' }}>
  <Button kind="primary">Save</Button>
</Tile>
```

### 2. Using Tailwind Colors
```tsx
// ❌ Don't do this
<span className="text-green-600">Success</span>

// ✅ Do this instead
<span style={{ color: 'var(--cds-support-success, #24a148)' }}>Success</span>
```

### 3. Custom Tables
```tsx
// ❌ Don't do this
<table className="w-full">
  <thead>...</thead>
  <tbody>...</tbody>
</table>

// ✅ Do this instead
<DataTableWrapper rows={rows} columns={columns} />
```

### 4. Border Radius
```tsx
// ❌ Don't do this (violates Carbon's sharp corners)
<div className="rounded-lg">...</div>
<div className="rounded-xl">...</div>
<div className="rounded-2xl">...</div>

// ✅ Do this instead (0 border radius for most elements)
<div style={{ borderRadius: 0 }}>...</div>

// Exception: Avatar circles CAN use 50% radius
<div style={{ borderRadius: '50%' }}>...</div>
```

---

## Resources

- [Carbon Design System Documentation](https://carbondesignsystem.com/)
- [Carbon React Components](https://react.carbondesignsystem.com/)
- [Carbon Icons](https://carbon-icons-svelte.onrender.com/)
- [Carbon Colors](https://carbondesignsystem.com/guidelines/color/overview/)

---

## Questions?

If you're unsure about a pattern:
1. Check existing components in `components/ui/`
2. Look at `Settings.tsx`, `Financials.tsx`, or `ClientDirectory.tsx` for examples
3. Refer to the Carbon React Storybook
4. When in doubt, use the Carbon component over a custom implementation

---

**Remember:** Consistency is key. When in doubt, follow Carbon Design System principles over custom styling.

# IBM Carbon Design System Audit Report

**Project:** Affinity Logistics CRM  
**Date:** 2026-03-30  
**Auditor:** Kimi Code  
**Carbon Version:** @carbon/react ^1.103.0, @carbon/icons-react ^11.76.0  

---

## Executive Summary

| Category | Score | Status |
|----------|-------|--------|
| Component Usage | 7/10 | ✅ Good |
| Visual Consistency | 5/10 | ⚠️ Needs Improvement |
| Token Usage | 6/10 | ⚠️ Partial |
| Accessibility | 8/10 | ✅ Good |
| Iconography | 9/10 | ✅ Excellent |
| Layout & Spacing | 5/10 | ⚠️ Inconsistent |
| **Overall** | **6.5/10** | **⚠️ Needs Improvement** |

---

## ✅ What's Implemented Well

### 1. Core Carbon Components (Good Coverage)

**Fully utilized components:**
- `Button` - Wrapped in `components/ui/Button.tsx` with proper kind mapping
- `Header`, `HeaderNavigation`, `HeaderGlobalBar`, `SideNav` - Proper shell implementation
- `Modal` - Used via `CarbonFormModal` wrapper
- `Form`, `TextInput`, `PasswordInput`, `TextArea`, `Stack` - Login and form modals
- `Tile` - Used in `StatCard` and `InsightPanel`
- `Tag` - Used in `StatusBadge` with comprehensive status mapping
- `Loading`, `InlineLoading` - App initialization and async states
- `SkeletonText`, `SkeletonPlaceholder` - Loading states
- `SkipToContent` - Accessibility feature in Layout

### 2. Icons (@carbon/icons-react)

**Excellent implementation:**
```tsx
import { ChartBar, Calculator, Money, Document, Van, UserMultiple, Settings, Logout, UserAvatar, Close, Login, Email } from '@carbon/icons-react';
```

All navigation and action icons use Carbon icons consistently.

### 3. Design Tokens (Partial Usage)

**Good usage of Carbon CSS variables:**
```css
--cds-background, #f4f4f4
--cds-text-primary, #161616
--cds-text-secondary, #525252
--cds-link-primary, #0f62fe
--cds-focus, #0f62fe
--cds-border-subtle, #c6c6c6
--cds-layer, #ffffff
--cds-support-success, #24a148
--cds-support-error, #da1e28
--cds-support-warning, #f1c21b
--cds-support-info, #0f62fe
```

**Usage in components:**
- `StatCard.tsx` - Uses Carbon tokens for colors
- `StatusBadge.tsx` - Maps status to Carbon Tag types
- `app.css` - Global form elements styled with Carbon tokens

### 4. Typography

**IBM Plex Sans properly configured:**
```css
--app-font-sans: 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif;
```

### 5. Accessibility

- ✅ `SkipToContent` component for keyboard navigation
- ✅ Proper ARIA labels on navigation
- ✅ Focus-visible styles using Carbon tokens
- ✅ `aria-expanded`, `aria-current`, `aria-label` attributes
- ✅ Reduced motion support in `index.html`

---

## ⚠️ Issues & Recommendations

### 1. MIXED STYLING APPROACH (Critical)

**Problem:** Heavy use of Tailwind CSS alongside Carbon creates visual inconsistency.

**Evidence:**
```tsx
// ❌ Custom styled divs instead of Carbon components
<div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200">
  <h2 className="text-4xl font-black mt-3 text-zinc-900">
</div>

// ❌ Custom buttons instead of Carbon Button
<button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm">

// ❌ Custom form inputs instead of Carbon TextInput
<input className="w-full px-4 py-2 rounded-lg border border-zinc-200" />
```

**Impact:**
- Visual inconsistency across the app
- Violation of Carbon's 0-border-radius principle
- Different color palettes (Carbon vs Tailwind zinc/blue/emerald)
- Maintenance burden

**Recommendation:**
```tsx
// ✅ Use Carbon components exclusively
import { Button, TextInput, Tile } from '@carbon/react';

<Tile>
  <TextInput id="name" labelText="Name" />
  <Button kind="primary">Submit</Button>
</Tile>
```

---

### 2. NON-CARBON BORDER RADIUS (High Priority)

**Problem:** Extensive use of `rounded-*` classes conflicts with Carbon's sharp corners.

**Files affected:**
- `AdminDashboard.tsx` - `rounded-xl`, `rounded-2xl`, `rounded-3xl`
- `Settings.tsx` - `rounded-lg`, `rounded-xl`, `rounded-2xl`
- `AdminOverviewView.tsx` - `rounded-3xl`
- `VehiclesTab.tsx` - `rounded-xl`, `rounded-3xl`
- Most dashboard components

**Carbon Design Principle:**
> Carbon uses 0 border radius for most components to convey precision, efficiency, and professionalism.

**Recommendation:**
Remove all `rounded-*` classes or replace with Carbon's subtle rounding where appropriate.

---

### 3. CUSTOM FORM INPUTS (High Priority)

**Problem:** Many forms use custom-styled inputs instead of Carbon form components.

**Files with custom inputs:**
- `Settings.tsx` - Company profile form (lines 525-611)
- Various modal components

**Current:**
```tsx
<input
  type="text"
  value={company.name}
  onChange={(e) => setCompany({ ...company, name: e.target.value })}
  className="w-full px-4 py-2 rounded-lg border border-zinc-200"
/>
```

**Should be:**
```tsx
<TextInput
  id="company-name"
  labelText="Legal Company Name"
  value={company.name}
  onChange={(e) => setCompany({ ...company, name: e.target.value })}
/>
```

---

### 4. MISSING CARBON DATA TABLE (High Priority)

**Problem:** All tables are custom HTML tables instead of Carbon DataTable.

**Files affected:**
- `AdminOverviewView.tsx` - Inventory table
- `VehiclesTab.tsx` - Vehicle list table
- `Settings.tsx` - User management table
- `PayslipsListView.tsx` - Payslips table

**Current:**
```tsx
<table className="w-full text-left text-sm">
  <thead><tr>...</tr></thead>
  <tbody>...</tbody>
</table>
```

**Should use:**
```tsx
import { DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
```

**Benefits:**
- Built-in sorting
- Batch actions
- Search/filter
- Pagination
- Responsive behavior
- Accessibility

---

### 5. INCONSISTENT BUTTON USAGE (Medium Priority)

**Problem:** Mix of Carbon Button (via wrapper) and custom buttons.

**Inconsistent patterns:**
```tsx
// ✅ Carbon Button (good)
<Button type="submit" renderIcon={LoginIcon}>Sign in</Button>

// ❌ Custom button (inconsistent)
<button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl">
```

**Recommendation:**
Standardize on Carbon Button through the existing `components/ui/Button.tsx` wrapper.

---

### 6. COLOR PALETTE INCONSISTENCY (Medium Priority)

**Problem:** Mix of Carbon tokens and Tailwind colors.

**Examples:**
```tsx
// Carbon tokens (good)
'var(--cds-support-success, #24a148)'

// Tailwind colors (inconsistent)
'bg-blue-600', 'text-zinc-900', 'border-zinc-200'
'bg-emerald-600', 'bg-purple-600'
```

**Carbon Color Palette:**
- Blue: `#0f62fe` (--cds-interactive)
- Gray 100: `#161616` (--cds-text-primary)
- Gray 70: `#525252` (--cds-text-secondary)
- Green: `#24a148` (--cds-support-success)
- Red: `#da1e28` (--cds-support-error)

**Recommendation:**
Replace Tailwind colors with Carbon design tokens.

---

### 7. MISSING CARBON COMPONENTS (Medium Priority)

**Components that should be used but aren't:**

| Component | Use Case | Current Alternative |
|-----------|----------|---------------------|
| `DataTable` | All tables | Custom HTML tables |
| `Breadcrumb` | Navigation trail | None |
| `Pagination` | Long lists | None |
| `Dropdown` | Select inputs | Native `<select>` |
| `DatePicker` | Date inputs | Native `<input type="date">` |
| `NumberInput` | Numeric fields | TextInput with type="number" |
| `Select` | Dropdowns | Native `<select>` |
| `Accordion` | Expandable sections | Custom implementation |
| `Tabs` | Tab navigation | Custom tabs |
| `OverflowMenu` | Action menus | Custom buttons |
| `Tooltip` | Help text | Native title attribute |
| `Notification` | Toast messages | Custom Toast component |

---

### 8. SPACING INCONSISTENCY (Low Priority)

**Problem:** Mix of Carbon spacing and Tailwind spacing.

**Carbon Spacing Scale:**
- `$spacing-01`: 2px
- `$spacing-02`: 4px
- `$spacing-03`: 8px
- `$spacing-04`: 12px
- `$spacing-05`: 16px
- `$spacing-06`: 24px
- `$spacing-07`: 32px
- `$spacing-08`: 40px
- `$spacing-09`: 48px
- `$spacing-10`: 64px

**Current:**
```tsx
// Tailwind arbitrary values
style={{ padding: '1.5rem', gap: '0.75rem' }}
className="p-8 py-6 px-8"
```

**Recommendation:**
Use Carbon's spacing tokens via CSS variables where possible.

---

### 9. CUSTOM MODAL IMPLEMENTATIONS (Medium Priority)

**Problem:** Some modals use Carbon Modal, others use custom implementations.

**Files using Carbon Modal:**
- `CarbonFormModal.tsx` ✅
- `Login.tsx` (indirectly via form)

**Files using custom modals:**
- `Settings.tsx` - Multiple custom modals
- `VehiclesTab.tsx` - Delete confirmation modal
- `AdminDashboard.tsx` - Various modals

**Custom modal pattern (inconsistent):**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="bg-white rounded-3xl p-8 max-w-md">
</div>
```

**Recommendation:**
Standardize on `CarbonFormModal` or Carbon's `Modal` component.

---

### 10. NO THEME SWITCHING (Low Priority)

**Problem:** Only light theme is implemented. Carbon supports light/dark themes out of the box.

**Recommendation:**
Consider adding a theme toggle using Carbon's theme system.

---

## 📋 Priority Action Plan

### Phase 1: Critical (Immediate)

1. **Audit and document** all custom button usage, replace with Carbon Button
2. **Remove border-radius** from critical user paths (forms, modals, cards)
3. **Standardize on Carbon Modal** for all dialog interactions

### Phase 2: High Priority (1-2 weeks)

4. **Migrate Settings forms** to Carbon form components
5. **Implement Carbon DataTable** for the most critical table (Vehicle inventory)
6. **Replace Tailwind colors** with Carbon tokens in shared UI components

### Phase 3: Medium Priority (2-4 weeks)

7. **Migrate all tables** to Carbon DataTable
8. **Replace Dropdowns** with Carbon Select/Dropdown
9. **Add Carbon Breadcrumbs** for navigation
10. **Implement Carbon Pagination** for long lists

### Phase 4: Polish (Ongoing)

11. **Spacing audit** - align with Carbon spacing scale
12. **Add missing components** (DatePicker, NumberInput, OverflowMenu)
13. **Consider dark theme** support

---

## 📁 Files Requiring Attention

### High Priority

| File | Issues | Effort |
|------|--------|--------|
| `Settings.tsx` | Custom forms, custom modals, Tailwind styling | High |
| `AdminOverviewView.tsx` | Custom cards, custom table | Medium |
| `VehiclesTab.tsx` | Custom cards, custom table, custom modal | Medium |
| `AdminDashboard.tsx` | Custom action buttons, mixed styling | Medium |

### Medium Priority

| File | Issues | Effort |
|------|--------|--------|
| `components/ui/*.tsx` | Some custom styling | Low |
| `shared/*Modal.tsx` | Most are good, some inconsistencies | Low |
| `AdminClientsView.tsx` | Likely custom table | Medium |
| `AdminEmployeesView.tsx` | Likely custom table | Medium |

### Low Priority

| File | Issues | Effort |
|------|--------|--------|
| `DashboardSectionSwitcher.tsx` | Custom tabs (could use Carbon Tabs) | Low |
| Various view components | Minor styling inconsistencies | Low |

---

## 🎯 Carbon Best Practices Checklist

- [x] Use `@carbon/react` components over custom implementations
- [x] Use `@carbon/icons-react` for all icons
- [x] Apply Carbon design tokens for colors
- [x] Use IBM Plex font family
- [ ] Avoid border-radius (Carbon uses sharp corners)
- [ ] Use Carbon spacing scale
- [x] Implement proper focus states
- [x] Include SkipToContent for accessibility
- [ ] Use Carbon DataTable for tabular data
- [ ] Use Carbon form components (TextInput, Select, DatePicker)
- [ ] Consider theming (light/dark)

---

## Summary

The Affinity Logistics CRM has a **solid foundation** with Carbon Design System but suffers from **visual inconsistency** due to mixed Tailwind CSS usage. The core shell (Header, SideNav), icons, and several components are properly implemented with Carbon. However, the dashboard views and forms heavily rely on custom Tailwind styling that conflicts with Carbon design principles.

**Key recommendation:** Commit to Carbon Design System fully by gradually replacing Tailwind-styled components with their Carbon equivalents. Start with high-impact areas (forms, tables, modals) and work toward complete consistency.

**Estimated effort for full compliance:** 2-3 weeks of focused work, or ongoing gradual migration over 1-2 months.

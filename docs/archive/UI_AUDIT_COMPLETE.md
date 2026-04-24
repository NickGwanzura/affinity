# UI AUDIT REPORT — IBM Carbon Compliance

**Date:** 2026-04-05  
**Auditor:** Kimi Code  
**Scope:** Complete frontend UI audit for IBM Carbon Design System compliance

---

## EXECUTIVE SUMMARY

The application has significant UI inconsistencies that deviate from IBM Carbon Design System principles. While some components follow Carbon patterns correctly, major sections use custom Tailwind CSS styling that breaks design consistency.

### Overall Grade: **C+** (Partially Compliant)

---

## AUDIT FINDINGS

### 🔴 CRITICAL ISSUES (Must Fix)

#### 1. **FinancialsSections.tsx** — Severe Non-Compliance
- **Issue:** Entire file uses Tailwind CSS classes instead of Carbon tokens
- **Problems Found:**
  - `border-zinc-100`, `bg-zinc-50`, `text-blue-600` — Non-Carbon colors
  - Custom HTML `<table>` instead of Carbon `DataTable`
  - Custom buttons instead of Carbon `Button`
  - Custom badges using `span` with arbitrary colors instead of Carbon `Tag`
  - `rounded` classes violate Carbon's sharp corner principle
  - Mobile cards use custom styling instead of Carbon `Tile`
- **Impact:** Completely breaks visual consistency with rest of app
- **Action:** Complete rewrite using Carbon DataTable, Button, Tag, Tile

#### 2. **Financials.tsx Modals** — Severe Non-Compliance
- **Issue:** Quote and Invoice modals are custom implementations
- **Problems Found:**
  - Uses `div` with `fixed inset-0` instead of Carbon `ComposedModal`
  - Custom form inputs instead of Carbon `TextInput`, `Select`, `TextArea`
  - Tailwind spacing classes (`space-y-4`, `p-4`, etc.)
  - Custom grid layouts instead of Carbon `Grid`/`Column`
  - Line items use custom styled divs instead of Carbon structured list
  - Custom styled buttons at modal footer
- **Impact:** Modals feel inconsistent, poor accessibility, cramped layout
- **Action:** Create dedicated Carbon modal components

#### 3. **ConfirmModal.tsx** — Complete Custom Implementation
- **Issue:** Entirely custom modal not using any Carbon components
- **Problems Found:**
  - Custom `div` with `fixed inset-0 bg-black/50`
  - `rounded-full` on icon container (violates Carbon sharp corners)
  - Tailwind colors throughout (`bg-red-100`, `text-zinc-900`)
  - No Carbon Modal, ModalHeader, ModalBody, ModalFooter
- **Impact:** Inconsistent modal behavior, different animation, poor accessibility
- **Action:** Refactor to use Carbon `ComposedModal`

---

### 🟡 MODERATE ISSUES (Should Fix)

#### 4. **ClientDirectory.tsx** — Mixed Compliance
- **Good:** Uses Carbon `Modal`, `TextInput`, `Button`, `Tag`, `Form`, `Stack`
- **Issues:**
  - Custom search input instead of `Search` component
  - Custom styled client list sidebar with Tailwind classes
  - Tables use custom HTML instead of `DataTable`
  - Status badges use custom CSS classes with mapped colors
  - Custom styled tabs instead of Carbon `Tabs`
- **Action:** Refactor tables to DataTable, use Carbon Tabs

#### 5. **Button.tsx** — Good Foundation
- **Good:** Properly wraps Carbon `Button`, maps variants correctly
- **Minor Issue:** `secondary` maps to `primary` which may confuse hierarchy
- **Status:** Acceptable, document the variant mapping

---

### 🟢 COMPLIANT COMPONENTS (Keep)

#### 6. **CarbonPaymentModal.tsx** — Excellent
- ✅ Uses `ComposedModal`, `ModalHeader`, `ModalBody`, `ModalFooter`
- ✅ Proper `Grid`/`Column` layout
- ✅ Carbon `TextInput`, `Select`, `Dropdown`, `NumberInput`
- ✅ Carbon `Button` with proper variants
- ✅ Carbon `Tag` for status
- ✅ Proper spacing using Carbon tokens
- ✅ `hasScrollingContent` for long forms

#### 7. **DataTableWrapper.tsx** — Excellent
- ✅ Proper Carbon `DataTable` implementation
- ✅ `TableToolbar`, `TableToolbarSearch`, `TableBatchActions`
- ✅ Uses Carbon `Button` for actions
- ✅ Proper Carbon tokens for styling

#### 8. **Layout.tsx** — Good
- ✅ Carbon `Header`, `HeaderNavigation`, `SideNav`
- ✅ Carbon `Tag` for role badges
- ✅ Proper Carbon tokens
- **Minor:** Custom mobile nav is acceptable

---

## REFACTOR PLAN

### Phase 1: Critical Modal Refactor
1. Create `CarbonConfirmModal.tsx` — Replace custom confirm modal
2. Create `CarbonInvoiceModal.tsx` — Replace Financials invoice modal
3. Create `CarbonQuoteModal.tsx` — Replace Financials quote modal
4. Update `Financials.tsx` to use new modal components

### Phase 2: Table Refactor
1. Refactor `FinancialsSections.tsx`:
   - Replace custom tables with `DataTableWrapper`
   - Replace custom badges with `Tag`
   - Replace custom buttons with Carbon `Button`
   - Use `OverflowMenu` for row actions

2. Refactor `ClientDirectory.tsx`:
   - Replace invoice/quote/payment tables with `DataTableWrapper`
   - Replace statement table with Carbon `DataTable`
   - Use Carbon `Tabs` instead of custom tabs

### Phase 3: Polish & Consistency
1. Fix `ConfirmModal.tsx` to use Carbon
2. Ensure all numeric values align right in tables
3. Add proper empty states using Carbon `Tile`
4. Add loading states using `InlineLoading`
5. Verify responsive behavior

---

## DESIGN TOKENS REFERENCE

### Colors
```
Primary:        var(--cds-interactive, #0f62fe)
Success:        var(--cds-support-success, #24a148)
Error:          var(--cds-support-error, #da1e28)
Warning:        var(--cds-support-warning, #f1c21b)
Text Primary:   var(--cds-text-primary, #161616)
Text Secondary: var(--cds-text-secondary, #525252)
Layer 01:       var(--cds-layer-01, #ffffff)
Layer 02:       var(--cds-layer-02, #f4f4f4)
Border Subtle:  var(--cds-border-subtle, #c6c6c6)
```

### Spacing (rem-based)
```
$spacing-01: 2px   (0.125rem)
$spacing-02: 4px   (0.25rem)
$spacing-03: 8px   (0.5rem)
$spacing-04: 12px  (0.75rem)
$spacing-05: 16px  (1rem)
$spacing-06: 24px  (1.5rem)
$spacing-07: 32px  (2rem)
```

### Border Radius
```
Default: 0 (sharp corners)
Exception: 50% for avatars only
```

---

## BUTTON HIERARCHY

### Primary Actions
- Create new records (Create Quote, Create Invoice)
- Save changes
- Generate statements

### Secondary Actions
- Edit (opens modal)
- Preview/Download
- Add line items

### Ghost Actions
- Cancel (in modals)
- Back/Navigation
- Secondary options

### Danger Actions
- Delete (with confirmation)
- Cancel destructive operations

### Overflow Menu (Row Actions)
- All row-level actions: Edit, Delete, Preview, Download, Convert

---

## MODAL SPECIFICATIONS

### Size Guidelines
- **xs (small):** Confirmations, simple forms (320px)
- **sm (medium):** Client form, simple edits (480px)
- **md (large):** Payment modal (640px)
- **lg (xlarge):** Invoice/Quote with line items (768px)

### Structure
```
ComposedModal (size="lg")
├── ModalHeader (title, subtitle)
├── ModalBody (hasScrollingContent for long forms)
│   ├── Section headers (h4 with Carbon tokens)
│   ├── Grid/Column layouts
│   ├── Form inputs
│   └── Summary sections
└── ModalFooter
    ├── Cancel (ghost)
    └── Primary Action
```

### Spacing Inside Modals
- Section gaps: `gap={6}` (24px)
- Input gaps: `gap={5}` (16px)
- Internal padding: Use `Grid` with proper columns

---

## TABLE SPECIFICATIONS

### Use DataTableWrapper with:
- `TableToolbar` with search
- `TableBatchActions` for multi-select delete
- `OverflowMenu` for row actions (not inline buttons)
- Right-aligned numeric columns
- Carbon `Tag` for status

### Status Badge Mapping
```
Paid/Acknowledged → Tag type="green"
Sent/Active       → Tag type="blue"
Draft/Pending     → Tag type="warm-gray"
Overdue           → Tag type="red"
Cancelled         → Tag type="high-contrast"
```

---

## SUCCESS CRITERIA

After refactor, the UI should:
- ✅ Use ONLY Carbon components (no custom HTML equivalents)
- ✅ Have ZERO Tailwind color classes
- ✅ Have ZERO border-radius (except avatars)
- ✅ Have consistent 0px border-radius on all elements
- ✅ Use proper button hierarchy
- ✅ Use OverflowMenu for all row actions
- ✅ Have spacious, readable modals
- ✅ Use DataTable for all tabular data
- ✅ Follow Carbon spacing scale

---

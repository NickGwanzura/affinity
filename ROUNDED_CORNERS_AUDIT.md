# Rounded Corners Audit Report

**Date:** 2026-03-30  
**Carbon Design Principle:** Carbon uses 0 border radius (sharp corners) for most components

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 50+ | Cards, modals, buttons with rounded-xl/2xl/3xl |
| High | 80+ | Form inputs with rounded corners |
| Medium | 40+ | Tags, badges, small elements |
| Low | 30+ | Icons, spinners (acceptable) |

---

## Critical Files Requiring Fixes

### 1. AccountantDashboard.tsx
- **Lines 754, 767, 780, 795**: `rounded-2xl` on stat cards
- **Lines 757, 770, 783, 798**: `rounded-xl` on icon containers
- **Line 810**: `rounded-2xl` on table container
- **Lines 896, 927**: `rounded-lg` on buttons

### 2. Financials.tsx (Worst Offender)
- **Lines 1331, 1340**: `rounded-xl` on action buttons
- **Lines 1353, 1639, 2013**: `rounded-2xl/3xl` on modals
- **Lines 1376-2302**: 50+ instances of `rounded-xl/lg` on form inputs

### 3. Settings.tsx
- **Lines 483, 756, 1090, 1198**: `rounded-2xl/xl` on cards/containers
- **Lines 635-665**: `rounded-xl` on KPI cards
- **Lines 841, 848, 963, 970**: `rounded-full` on avatars (acceptable)
- **Lines 1294-1765**: Modal forms with `rounded-xl` inputs

### 4. Documents.tsx
- **Lines 124, 147, 157, 210, 239**: `rounded-2xl/3xl` on cards
- **Lines 129, 137, 253, 263**: `rounded-xl` on buttons/containers

### 5. Shared Components

#### ExpenseEntryModal.tsx
- **Lines 87-200**: 10+ `rounded-xl` on form inputs

#### PayslipFormModal.tsx
- **Lines 92-94**: `rounded-xl/lg` on input classes
- **Lines 156, 186, 208**: `rounded-2xl` on panels

#### OperatingFundEntryModal.tsx
- **Lines 98-331**: 15+ `rounded-xl` on form elements

#### FinancialsSections.tsx
- **Lines 22-540**: 30+ `rounded-xl/2xl` throughout

---

## Acceptable Uses (Low Priority)

These can remain as they serve specific UX purposes:

1. **Avatars/Profile Images** - `rounded-full` is acceptable for user photos
2. **Status Indicators** - Small `rounded-full` dots for online/offline status
3. **Spinners** - `rounded-full` for loading animations
4. **Radio Buttons** - `rounded-full` for the indicator circle

---

## Carbon-Compliant Replacement Guide

| Tailwind Class | Carbon Replacement |
|----------------|-------------------|
| `rounded-3xl` | Remove (0 radius) |
| `rounded-2xl` | Remove (0 radius) |
| `rounded-xl` | Remove (0 radius) |
| `rounded-lg` | Remove (0 radius) |
| `rounded-md` | Remove (0 radius) |
| `rounded-sm` | Remove (0 radius) |
| `rounded-full` | Keep for avatars/spinners only |

---

## Quick Fix Strategy

### Option 1: Global Replace (Aggressive)
```bash
# Remove all rounded classes except rounded-full for avatars
sed -i '' 's/rounded-[23]xl//g' components/**/*.tsx
sed -i '' 's/rounded-xl//g' components/**/*.tsx
sed -i '' 's/rounded-lg//g' components/**/*.tsx
sed -i '' 's/rounded-md//g' components/**/*.tsx
```

### Option 2: Component-by-Component (Recommended)
Fix files one at a time, testing after each:
1. AccountantDashboard.tsx
2. Financials.tsx
3. Settings.tsx
4. Documents.tsx
5. Shared modals

---

## Priority Order

1. **High Impact (Fix First)**
   - Cards and containers (rounded-2xl/3xl)
   - Primary action buttons
   - Modal dialogs

2. **Medium Impact**
   - Form inputs
   - Secondary buttons
   - Table containers

3. **Low Impact (Optional)**
   - Tags and badges
   - Small UI elements
   - Avatar images (keep rounded-full)

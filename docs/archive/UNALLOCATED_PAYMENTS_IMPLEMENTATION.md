# Unallocated Payments Implementation

## Summary

This implementation allows payments to be recorded and reduce client balance **even when no invoice exists**. This supports:

- Advance payments (payments received before invoicing)
- On-account credits (overpayments that can be allocated later)
- Client balance tracking that includes all payments, not just invoice-linked ones

---

## Files Modified

### 1. Database Migration
**File:** `UNALLOCATED_PAYMENTS_MIGRATION.sql`

**Changes:**
- Made `invoice_id` nullable in `payment_allocations` table
- Added `status` column (`allocated` | `unallocated` | `credit`) to track allocation type
- Added `client_id` column to `payment_allocations` for client-level balance tracking
- Added `client_id` and `status` columns to `payments` table
- Created `client_balances` view for easy balance calculation
- Created `get_client_balance(client_name)` function
- Created trigger to auto-populate `client_id` from `client_name`
- Added indexes for performance

---

### 2. API Schema Validation
**File:** `api/_schemas.ts`

**Changes:**
```typescript
// Made invoice_id optional
export const PaymentAllocationSchema = z.object({
  invoice_id: z.string().uuid().optional(),  // ← Was required
  amount_allocated: z.number().positive(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  status: z.enum(['allocated', 'unallocated', 'credit']).optional(),  // ← Added
});

// Made reference_id optional, added client_id and status
export const PaymentSchema = z.object({
  reference_id: z.string().min(1).optional().or(z.literal('')),  // ← Now optional
  client_name: z.string().min(1),
  client_id: z.string().uuid().optional(),  // ← Added
  type: z.enum(['Inbound', 'Outbound']).default('Inbound'),
  amount_usd: z.number().positive(),
  currency: z.enum(['USD', 'GBP']).default('USD'),
  method: z.string().min(1),
  date: DateLikeSchema,
  status: z.enum(['allocated', 'unallocated', 'credit']).optional().default('allocated'),  // ← Added
  allocations: z.array(PaymentAllocationSchema).optional(),
});
```

---

### 3. API Payment Logic
**File:** `api/payments.ts`

**Changes:**
- Updated `PaymentRow` type to include `client_id` and `status` fields
- Updated `attachAllocations` to include `status` column in queries
- Modified `replaceAllocationsForPayment` to:
  - Handle optional `invoice_id` in allocations
  - Set allocation status based on whether invoice_id is present
  - Create unallocated allocation entries for tracking
  - Support `client_id` lookup and storage
- Updated `createPayment` to:
  - Auto-generate reference_id (`PAY-${timestamp}` or `UNALLOC-${timestamp}`) when not provided
  - Determine payment status based on allocations
  - Create unallocated allocation entries when no invoices specified
- Updated `updatePayment` to handle new fields and status
- Updated `replaceAllocations` to update payment status based on allocation type

---

### 4. TypeScript Types
**File:** `types.ts`

**Changes:**
```typescript
export interface Payment {
  id: string;
  reference_id: string;
  client_name?: string;
  client_id?: string;  // ← Added
  type: 'Inbound' | 'Outbound';
  amount_usd: number;
  currency?: 'USD' | 'GBP';
  method: string;
  date: string;
  status?: 'allocated' | 'unallocated' | 'credit';  // ← Added
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id?: string;  // ← Now optional
  client_id?: string;   // ← Added
  amount_allocated: number;
  currency: 'USD' | 'GBP';
  status?: 'allocated' | 'unallocated' | 'credit';  // ← Added
  created_at: string;
}
```

---

### 5. Data Service
**File:** `services/dataService.ts`

**Changes:**
```typescript
async replacePaymentAllocations(
  paymentId: string,
  allocations: Array<{ 
    invoice_id?: string;  // ← Now optional
    amount_allocated: number; 
    currency: 'USD' | 'GBP';
    status?: string;      // ← Added
  }>,
): Promise<void> {
  await api.payments.replaceAllocations(paymentId, allocations);
}
```

---

### 6. Frontend Payment Form
**File:** `components/Financials.tsx`

**Changes:**
- Modified `handleRecordPayment` validation:
  - Removed requirement that every allocation must have an invoice_id
  - Now validates only allocations that specify an invoice_id
  - Creates unallocated payment entries when no invoices are selected
  - Auto-generates `UNALLOC-${timestamp}` reference for unallocated payments
  
- Updated allocation merging logic to support both allocated and unallocated payments

- Updated `getPaymentAllocationSummary` to show "Unallocated payment (client credit)" for unallocated payments

- Added clear messaging in payment modal when no invoices are available:
  ```
  "No pending invoices found for this client in [currency].
   This payment will be recorded as UNALLOCATED (client credit).
   The payment will reduce the client's balance and can be allocated to invoices later."
  ```

---

### 7. Payment List UI
**File:** `components/financials/FinancialsSections.tsx`

**Changes:**
- Added `getPaymentStatusBadge` helper function to show:
  - "Unallocated" badge (amber) for unallocated payments
  - "Inbound/Outbound" text for regular payments
  
- Updated PaymentsSection table:
  - Replaced "Type" column with "Status" column showing the badge
  - Shows unallocated status clearly in both mobile and desktop views

---

## Client Balance Calculation

The client balance is calculated as:

```
Client Balance = SUM(all invoice amounts for client)
                 - SUM(all inbound payments for client)
                 + adjustments
```

This now includes unallocated payments because:
1. All payments (including unallocated) are stored with `client_name`
2. The `get_client_balance` SQL function sums all inbound payments for a client
3. The statement generation includes payments where `payment.client_name === client.name`

---

## How It Works

### Recording an Unallocated Payment

1. User selects a client and enters payment amount
2. If no pending invoices exist for that client in the selected currency:
   - System shows message that payment will be unallocated
3. On submit:
   - Payment record created with `status: 'unallocated'` and auto-generated `reference_id`
   - Allocation record created with `invoice_id: NULL` and `status: 'unallocated'`
   - Client balance is reduced by payment amount

### Allocating an Unallocated Payment Later

1. User edits the unallocated payment
2. Selects one or more invoices to allocate to
3. On submit:
   - Payment status changes to `'allocated'`
   - New allocation records created with `invoice_id` populated
   - Previous unallocated allocation removed
   - Invoice payment status updated accordingly

---

## Database Queries

### View Client Balances
```sql
SELECT * FROM public.client_balances WHERE client_name = 'Client Name';
```

### Get Client Balance
```sql
SELECT public.get_client_balance('Client Name');
```

### Find Unallocated Payments for Client
```sql
SELECT * FROM public.payment_allocations 
WHERE status = 'unallocated' AND client_id = [client_uuid];
```

---

## Migration Steps

1. **Run the SQL migration:**
   ```bash
   # Execute UNALLOCATED_PAYMENTS_MIGRATION.sql in Supabase SQL Editor
   ```

2. **Deploy the code changes:**
   - All API changes are backward compatible
   - Existing invoice-linked payments continue to work as before
   - New unallocated payments are now supported

3. **Verify the changes:**
   - Test recording a payment without selecting invoices
   - Verify client balance is reduced
   - Test allocating the payment to an invoice later

---

## Backward Compatibility

✅ **Fully backward compatible:**
- Existing payments with invoice allocations continue to work
- API accepts both old format (with invoice_id) and new format (without)
- Frontend shows appropriate messaging for unallocated payments
- Database schema changes are additive only (new columns are nullable)

---

## Testing Checklist

- [ ] Record payment with invoice allocation (existing flow)
- [ ] Record payment without invoice allocation (new flow)
- [ ] Verify client balance calculation includes unallocated payments
- [ ] Edit unallocated payment to add invoice allocation
- [ ] Generate client statement with mixed allocated/unallocated payments
- [ ] Delete unallocated payment
- [ ] Verify receipt generation works for unallocated payments

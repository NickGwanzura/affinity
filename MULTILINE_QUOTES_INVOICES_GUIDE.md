# Multi-Line Quotes & Invoices - Implementation Guide

## 🎯 Overview

The system now supports **multi-line quotes and invoices** with dedicated database tables for line items, automatic total calculations, and a comprehensive API for managing them.

---

## 📊 Database Schema

### Quote Items Table
```sql
CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  line_number INTEGER CHECK (line_number > 0),
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (quote_id, line_number)
);
```

### Invoice Items Table
```sql
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INTEGER CHECK (line_number > 0),
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) DEFAULT 0,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE (invoice_id, line_number)
);
```

---

## 🔄 Automatic Total Calculation

**Database triggers** automatically update the parent quote/invoice total when line items are added, updated, or deleted:

```sql
-- Trigger updates quote.amount_usd automatically
CREATE TRIGGER quote_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_total();

-- Trigger updates invoice.amount_usd automatically
CREATE TRIGGER invoice_items_update_total
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();
```

**How it works:**
1. Add/update/delete a line item
2. Trigger calculates: `SUM(amount + tax_amount)` for all items
3. Parent quote/invoice total is automatically updated
4. No manual calculation needed!

---

## 🛠️ TypeScript Types

```typescript
export interface LineItem {
  id?: string;
  line_number?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate?: number;
  tax_amount?: number;
  notes?: string;
}

export interface QuoteItem extends LineItem {
  quote_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem extends LineItem {
  invoice_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  client_name: string;
  amount_usd: number;  // Auto-calculated from items
  status: FinancialStatus;
  items?: QuoteItem[];  // Populated from quote_items table
  // ... other fields
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  amount_usd: number;  // Auto-calculated from items
  status: FinancialStatus;
  items?: InvoiceItem[];  // Populated from invoice_items table
  // ... other fields
}
```

---

## 📡 API Methods

### Quote Items

#### Get All Items for a Quote
```typescript
const items = await supabase.getQuoteItems(quoteId);
// Returns: QuoteItem[] sorted by line_number
```

#### Add Item to Quote
```typescript
const newItem = await supabase.addQuoteItem(quoteId, {
  line_number: 1,
  description: 'Vehicle Transport - UK to Namibia',
  quantity: 1,
  unit_price: 2500.00,
  tax_rate: 15,  // 15% VAT
  notes: 'Includes insurance'
});
// Automatically calculates: amount and tax_amount
// Automatically updates: quote.amount_usd
```

#### Update Item
```typescript
const updated = await supabase.updateQuoteItem(itemId, {
  quantity: 2,
  unit_price: 2400.00
});
// Recalculates amount, tax_amount, and quote total
```

#### Delete Item
```typescript
await supabase.deleteQuoteItem(itemId);
// Automatically updates quote total
```

### Invoice Items

Same API pattern as quote items:

```typescript
// Get items
const items = await supabase.getInvoiceItems(invoiceId);

// Add item
const newItem = await supabase.addInvoiceItem(invoiceId, {
  line_number: 1,
  description: 'Vehicle Sale - Toyota Land Cruiser',
  quantity: 1,
  unit_price: 45000.00,
  tax_rate: 15
});

// Update item
await supabase.updateInvoiceItem(itemId, { quantity: 2 });

// Delete item
await supabase.deleteInvoiceItem(itemId);
```

---

## 💡 Usage Examples

### Creating a Quote with Multiple Items

```typescript
// 1. Create the quote
const quote = await supabase.createQuote({
  client_name: 'ABC Motors Ltd',
  client_email: 'orders@abcmotors.com',
  status: 'Draft',
  valid_until: '2026-02-28',
  amount_usd: 0  // Will be auto-calculated
});

// 2. Add line items
await supabase.addQuoteItem(quote.id, {
  line_number: 1,
  description: 'Vehicle: Toyota Land Cruiser 2020',
  quantity: 1,
  unit_price: 42000.00,
  tax_rate: 0
});

await supabase.addQuoteItem(quote.id, {
  line_number: 2,
  description: 'Shipping: UK to Namibia',
  quantity: 1,
  unit_price: 3500.00,
  tax_rate: 15
});

await supabase.addQuoteItem(quote.id, {
  line_number: 3,
  description: 'Import Duty & Clearance',
  quantity: 1,
  unit_price: 2800.00,
  tax_rate: 0
});

// 3. Total is automatically calculated!
// Subtotal: 42000 + 3500 + 2800 = 48,300
// Tax: 3500 * 0.15 = 525
// Grand Total: 48,825 (stored in quote.amount_usd)
```

### Fetching Quote with Items

```typescript
const quotes = await supabase.getQuotes();

quotes.forEach(quote => {
  console.log(`Quote ${quote.quote_number}: $${quote.amount_usd}`);
  
  quote.items?.forEach(item => {
    console.log(`  ${item.line_number}. ${item.description}`);
    console.log(`     Qty: ${item.quantity} × $${item.unit_price} = $${item.amount}`);
    if (item.tax_amount > 0) {
      console.log(`     Tax (${item.tax_rate}%): $${item.tax_amount}`);
    }
  });
});
```

### Converting Quote to Invoice

```typescript
// 1. Get the quote with items
const quote = quotes.find(q => q.id === selectedQuoteId);

// 2. Create invoice from quote
const invoice = await supabase.createInvoice({
  quote_id: quote.id,
  client_name: quote.client_name,
  client_email: quote.client_email,
  client_address: quote.client_address,
  status: 'Draft',
  due_date: '2026-03-15',
  amount_usd: 0  // Will be calculated
});

// 3. Copy all quote items to invoice items
for (const quoteItem of quote.items || []) {
  await supabase.addInvoiceItem(invoice.id, {
    line_number: quoteItem.line_number,
    description: quoteItem.description,
    quantity: quoteItem.quantity,
    unit_price: quoteItem.unit_price,
    tax_rate: quoteItem.tax_rate,
    notes: quoteItem.notes
  });
}

// Invoice now has same line items and total as quote!
```

---

## 🎨 UI Component Examples

### Line Items Table Component

```typescript
function QuoteItemsTable({ quoteId, items, onItemsChange }) {
  const [editingItem, setEditingItem] = useState(null);
  
  const handleAddItem = async () => {
    const newItem = await supabase.addQuoteItem(quoteId, {
      line_number: (items?.length || 0) + 1,
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 0
    });
    onItemsChange();
  };
  
  const handleUpdateItem = async (itemId, updates) => {
    await supabase.updateQuoteItem(itemId, updates);
    onItemsChange();
  };
  
  const handleDeleteItem = async (itemId) => {
    if (confirm('Delete this line item?')) {
      await supabase.deleteQuoteItem(itemId);
      onItemsChange();
    }
  };
  
  const subtotal = items?.reduce((sum, item) => sum + item.amount, 0) || 0;
  const taxTotal = items?.reduce((sum, item) => sum + item.tax_amount, 0) || 0;
  const grandTotal = subtotal + taxTotal;
  
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr>
            <th>Line</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
            <th>Tax %</th>
            <th>Tax</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items?.map(item => (
            <tr key={item.id}>
              <td>{item.line_number}</td>
              <td>
                {editingItem === item.id ? (
                  <input
                    value={item.description}
                    onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                  />
                ) : (
                  item.description
                )}
              </td>
              <td>{item.quantity}</td>
              <td>${item.unit_price.toFixed(2)}</td>
              <td>${item.amount.toFixed(2)}</td>
              <td>{item.tax_rate}%</td>
              <td>${item.tax_amount.toFixed(2)}</td>
              <td>
                <button onClick={() => setEditingItem(item.id)}>Edit</button>
                <button onClick={() => handleDeleteItem(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="4">Subtotal:</td>
            <td>${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan="4">Tax:</td>
            <td>${taxTotal.toFixed(2)}</td>
          </tr>
          <tr className="font-bold">
            <td colSpan="4">Grand Total:</td>
            <td>${grandTotal.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <button onClick={handleAddItem}>+ Add Line Item</button>
    </div>
  );
}
```

---

## 🔐 Security (RLS Policies)

All line item tables have Row Level Security enabled:

- **SELECT**: All authenticated users can view
- **INSERT**: Only Admin and Accountant roles
- **UPDATE**: Only Admin and Accountant roles
- **DELETE**: Only Admin role

Line items are automatically deleted when parent quote/invoice is deleted (CASCADE).

---

## 📈 Database Views & Functions

### Quote Details View
```sql
SELECT * FROM quote_details WHERE quote_id = 'xxx';
-- Returns all quote fields + joined line items
```

### Invoice Details View
```sql
SELECT * FROM invoice_details WHERE invoice_id = 'xxx';
-- Returns all invoice fields + joined line items
```

### Summary Functions
```sql
-- Get quote summary with totals
SELECT * FROM get_quote_summary('quote-uuid');

-- Returns:
-- - quote_id, quote_number, client_name, status
-- - line_count, subtotal, tax_total, grand_total
-- - valid_until, created_at
```

---

## 🧪 Testing

### Test Quote Creation
```typescript
// Create quote
const quote = await supabase.createQuote({
  client_name: 'Test Client',
  amount_usd: 0,
  status: 'Draft'
});

// Add 3 items
await supabase.addQuoteItem(quote.id, {
  line_number: 1,
  description: 'Item 1',
  quantity: 2,
  unit_price: 100,
  tax_rate: 10
});

await supabase.addQuoteItem(quote.id, {
  line_number: 2,
  description: 'Item 2',
  quantity: 1,
  unit_price: 500,
  tax_rate: 0
});

await supabase.addQuoteItem(quote.id, {
  line_number: 3,
  description: 'Item 3',
  quantity: 3,
  unit_price: 50,
  tax_rate: 15
});

// Fetch and verify
const quotes = await supabase.getQuotes();
const testQuote = quotes.find(q => q.id === quote.id);

console.log('Items count:', testQuote.items?.length);  // Should be 3
console.log('Total:', testQuote.amount_usd);  // Should be calculated correctly

// Expected calculation:
// Item 1: 2 × 100 = 200, Tax: 200 × 0.10 = 20, Total: 220
// Item 2: 1 × 500 = 500, Tax: 0, Total: 500
// Item 3: 3 × 50 = 150, Tax: 150 × 0.15 = 22.50, Total: 172.50
// Grand Total: 892.50
```

---

## 📝 Migration Checklist

- [x] Create `quote_items` table with proper schema
- [x] Create `invoice_items` table with proper schema
- [x] Add automatic total calculation triggers
- [x] Create database views for easy querying
- [x] Add RLS policies for security
- [x] Migrate existing JSONB data to new tables
- [x] Update TypeScript types
- [x] Add API methods for quote items
- [x] Add API methods for invoice items
- [x] Update getQuotes() to include items
- [x] Update getInvoices() to include items
- [ ] Update UI components to display line items
- [ ] Add line item editor component
- [ ] Add line item validation
- [ ] Update PDF export to show itemized breakdown
- [ ] Update CSV export to include line items
- [ ] Add tests for line item CRUD operations

---

## 🚀 Next Steps

1. **Run the migration SQL** in Supabase SQL Editor:
   - Execute `MULTILINE_QUOTES_INVOICES_MIGRATION.sql`
   - Verify tables created successfully
   - Check existing data migrated

2. **Update UI Components**:
   - Create `QuoteItemsEditor` component
   - Create `InvoiceItemsEditor` component
   - Add to quote/invoice detail views
   - Add inline editing capabilities

3. **Enhance Exports**:
   - Update PDF export to show itemized table
   - Update CSV export to include line-by-line breakdown
   - Add subtotals and tax breakdown

4. **Testing**:
   - Test creating quotes with multiple items
   - Test updating item quantities and prices
   - Test deleting items
   - Verify totals calculate correctly
   - Test converting quote to invoice

---

## 💰 Example Business Scenarios

### Scenario 1: Vehicle Sale with Services
```
Quote QT-2026-0042
Client: Horizon Transport Ltd

Line Items:
1. Toyota Land Cruiser 2022 (VIN: xxx)  1 × $45,000 = $45,000
2. Pre-shipment inspection                1 × $350    = $350
3. Shipping: UK to Namibia                1 × $3,200  = $3,200 (15% VAT)
4. Import duty processing                 1 × $500    = $500

Subtotal: $49,050
Tax (15% on shipping): $480
Grand Total: $49,530
```

### Scenario 2: Monthly Service Package
```
Invoice INV-2026-0089
Client: Fleet Solutions Inc

Line Items:
1. Fleet management service (Jan 2026)   1 × $2,500  = $2,500
2. GPS tracking subscription             10 × $25    = $250
3. Maintenance inspections               5 × $150    = $750
4. Emergency roadside support            1 × $500    = $500

Subtotal: $4,000
Tax: $0
Grand Total: $4,000
```

---

## 🔧 Troubleshooting

### Items not showing up
```typescript
// Make sure you're fetching with items included
const quotes = await supabase.getQuotes();
// Check: quotes[0].items should be an array
```

### Totals not calculating
```sql
-- Check if triggers exist
SELECT * FROM pg_trigger WHERE tgname LIKE '%update_total%';

-- Manually recalculate if needed
UPDATE quotes SET amount_usd = (
  SELECT COALESCE(SUM(amount + tax_amount), 0)
  FROM quote_items WHERE quote_id = quotes.id
);
```

### Line numbers out of order
```typescript
// Resequence line numbers
const items = await supabase.getQuoteItems(quoteId);
items.forEach((item, index) => {
  supabase.updateQuoteItem(item.id, { line_number: index + 1 });
});
```

---

**System Status:** ✅ Migration SQL Ready | ✅ API Methods Complete | 🔄 UI Integration Pending

**Last Updated:** January 22, 2026

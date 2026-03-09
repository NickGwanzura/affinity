# API Quick Reference - Production Ready Endpoints

## Authentication

### Sign Up New User
```typescript
await supabase.signUp(
  'user@example.com',
  'securePassword123',
  { name: 'John Doe', role: 'Driver' }
);
```
**Validates:** Email format, password length (min 8), sanitizes all inputs

### Login
```typescript
const session = await supabase.login('user@example.com', 'password');
// Returns: { user: { id, name, email, role, status } }
```
**Validates:** Email format, throws 401 on invalid credentials

### Logout
```typescript
await supabase.logout();
```

### Get Current Session
```typescript
const session = await supabase.getSession();
// Returns: AuthSession | null
```

---

## Vehicles

### Get All Vehicles
```typescript
const vehicles = await supabase.getVehicles();
```
**Returns:** Immutable array copy

### Add Vehicle
```typescript
await supabase.addVehicle({
  vin_number: 'ABC123456',
  make_model: 'Toyota Land Cruiser',
  purchase_price_gbp: 45000,
  status: 'UK'
});
```
**Validates:** 
- VIN: Required, min 5 chars, unique
- Price: Required, > 0
- Checks for duplicates

### Update Vehicle
```typescript
await supabase.updateVehicle(vehicleId, {
  status: 'Exported',
  purchase_price_gbp: 46000
});
```
**Validates:**
- VehicleID: Required
- Price: > 0 (if provided)
- Sanitizes all inputs

---

## Expenses

### Get All Expenses
```typescript
const expenses = await supabase.getExpenses();
```

### Get Expenses by Vehicle
```typescript
const expenses = await supabase.getExpensesByVehicle(vehicleId);
```
**Validates:** Vehicle ID exists

### Add Expense
```typescript
await supabase.addExpense({
  vehicle_id: 'v1',
  description: 'Fuel refill',
  amount: 250.50,
  currency: 'NAD',
  category: 'Fuel',
  location: 'Namibia',
  receipt_url: 'https://...'
});
```
**Validates:**
- Vehicle exists
- Amount > 0
- Valid currency
- Auto-calculates exchange rate

---

## Quotes

### Get All Quotes
```typescript
const quotes = await supabase.getQuotes();
```

### Create Quote
```typescript
const quote = await supabase.createQuote({
  vehicle_id: 'v1',
  client_name: 'ABC Motors',
  client_email: 'contact@abcmotors.com',
  client_address: '123 Main St',
  amount_usd: 58000,
  description: 'Toyota Land Cruiser Export',
  valid_until: '2026-02-15',
  status: 'Draft'
});
// Returns quote with auto-generated quote_number: QT-2026-0001
```
**Validates:**
- Vehicle exists
- Email format (if provided)
- Amount > 0
- Client name required

---

## Invoices

### Get All Invoices
```typescript
const invoices = await supabase.getInvoices();
```

### Create Invoice
```typescript
const invoice = await supabase.createInvoice({
  vehicle_id: 'v1',
  client_name: 'ABC Motors',
  client_email: 'billing@abcmotors.com',
  client_address: '123 Main St',
  amount_usd: 58000,
  description: 'Final payment for vehicle',
  due_date: '2026-02-28',
  status: 'Draft'
});
// Returns invoice with auto-generated invoice_number: INV-2026-0001
```
**Validates:**
- Vehicle exists
- Email format
- Amount > 0
- Due date format
- Client name required

---

## Clients

### Get All Clients
```typescript
const clients = await supabase.getClients();
```

### Create Client
```typescript
const client = await supabase.createClient({
  name: 'Global Exports Ltd',
  email: 'info@globalexports.com',
  phone: '+264 81 123 4567',
  address: '456 Business Blvd, Windhoek',
  company: 'Global Exports',
  notes: 'VIP Client'
});
```
**Validates:**
- Name and Email: Required
- Email format
- Checks for duplicate emails

### Update Client
```typescript
await supabase.updateClient(clientId, {
  phone: '+264 81 999 8888',
  notes: 'Updated contact info'
});
```

---

## Employees

### Get All Employees
```typescript
const employees = await supabase.getEmployees();
```

### Create Employee
```typescript
const employee = await supabase.createEmployee({
  name: 'Jane Smith',
  email: 'jane@affinity.com',
  position: 'Logistics Manager',
  base_pay_usd: 3500,
  date_hired: '2026-01-20',
  status: 'Active'
});
```
**Validates:**
- Name, Email, Position, Base Pay, Date Hired: Required
- Email format
- Base Pay > 0

### Update Employee
```typescript
await supabase.updateEmployee(employeeId, {
  position: 'Senior Logistics Manager',
  base_pay_usd: 4000
});
```

---

## Payslips

### Get Payslips
```typescript
const payslips = await supabase.getPayslips({ 
  employeeId: 'emp123', 
  year: 2026 
});
```

### Generate Payslip
```typescript
const payslip = await supabase.generatePayslip({
  employee_id: 'emp123',
  month: 1,
  year: 2026,
  base_pay: 3500,
  allowances: 200,
  deductions: 100,
  status: 'Generated'
});
```

---

## Analytics

### Get Landed Cost Summaries
```typescript
const summaries = await supabase.getLandedCostSummaries();
// Returns array with calculated costs per vehicle
```

### Get AI Insights (Gemini)
```typescript
const insights = await getLogisticsInsights(summaries);
// Returns: AI-generated business insights
```
**Features:**
- Rate limited (2s between calls)
- Retries on failure (3x with backoff)
- Fallback to manual analysis

---

## Company Settings

### Get Company Details
```typescript
const company = await supabase.getCompanyDetails();
```

### Update Company Details
```typescript
await supabase.updateCompanyDetails({
  name: 'Affinity Logistics Ltd',
  contact_email: 'info@affinity.com',
  address: '123 Business St',
  phone: '+44 20 1234 5678',
  website: 'www.affinity.com',
  logo_url: 'https://cdn.example.com/logo.png',
  registration_no: 'AL-2024-001',
  tax_id: 'VAT-UK-123'
});
```
**Validates:**
- Email format
- Auto-corrects website URL
- Sanitizes all text inputs

---

## Error Handling

### Error Types

**ValidationError** - Input validation failed
```typescript
try {
  await supabase.addVehicle({ ... });
} catch (error) {
  if (error.name === 'ValidationError') {
    console.log('Field:', error.field);
    console.log('Message:', error.message);
  }
}
```

**APIError** - HTTP/API error
```typescript
try {
  await supabase.login(email, password);
} catch (error) {
  if (error.name === 'APIError') {
    console.log('Status:', error.statusCode);
    console.log('Details:', error.details);
  }
}
```

---

## Console Logging

All API calls are automatically logged:

```
[2026-01-16T10:30:45.123Z] API POST: /vehicles { payload: {...} }
[2026-01-16T10:30:45.456Z] API POST: /vehicles { success: true, vehicleId: 'v123' }
```

Check browser console for:
- Request/response logs
- Validation errors
- Performance metrics
- Error traces

---

## Best Practices

### ✅ DO
- Always await async operations
- Wrap API calls in try-catch
- Validate inputs before API calls
- Check for null/undefined
- Use TypeScript types

### ❌ DON'T
- Mutate returned arrays directly
- Log sensitive data (passwords)
- Ignore validation errors
- Make parallel calls to rate-limited APIs
- Skip error handling

---

## Common Patterns

### Loading State
```typescript
const [loading, setLoading] = useState(true);

useEffect(() => {
  const load = async () => {
    try {
      const data = await supabase.getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };
  load();
}, []);
```

### Form Submission
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await supabase.addExpense(formData);
    alert('Success!');
    resetForm();
  } catch (error) {
    if (error.name === 'ValidationError') {
      alert(`Invalid ${error.field}: ${error.message}`);
    } else {
      alert('Failed to submit. Please try again.');
    }
  }
};
```

### Refresh After Update
```typescript
const handleAdd = async () => {
  await supabase.addVehicle(newVehicle);
  const updated = await supabase.getVehicles(); // Refresh list
  setVehicles(updated);
};
```

---

## Environment Setup

Required `.env` variables:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
GEMINI_API_KEY=your-gemini-key (optional)
```

---

## Quick Debugging

### Check Auth Status
```typescript
const session = await supabase.getSession();
console.log('Logged in:', !!session);
console.log('User:', session?.user);
```

### Verify API Logs
Open browser console and filter by:
- `[SUPABASE]` - Client logs
- `[GEMINI]` - AI API logs
- `API GET/POST/PUT` - Service logs

### Common Issues

**"Missing Supabase environment variables"**
- Check `.env` file exists in root
- Restart dev server after adding env vars

**"Vehicle not found" on addExpense**
- Vehicle ID is case-sensitive
- Check vehicle exists: `await supabase.getVehicles()`

**"Invalid email format"**
- Email must contain @ and domain
- Example: user@example.com

---

**Quick Reference Generated:** January 22, 2026  
**API Version:** 1.1.0 (Production Ready - Extended)

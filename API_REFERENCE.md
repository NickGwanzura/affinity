# 🔌 API Quick Reference

## Supabase Service Methods

### 🔐 Authentication
```typescript
// Sign up new user
await supabase.signUp(email, password, { name, role });

// Login
const session = await supabase.login(email, password);

// Logout
await supabase.logout();

// Check session
const session = await supabase.getSession();

// Reset password
await supabase.resetPassword(email);

// Update password
await supabase.updatePassword(newPassword);
```

### 🚗 Vehicles
```typescript
// Get all vehicles
const vehicles = await supabase.getVehicles();

// Add new vehicle
await supabase.addVehicle({
  vin_number: string,
  make_model: string,
  purchase_price_gbp: number,
  status: 'UK' | 'Namibia' | 'Zimbabwe' | 'Sold'
});

// Update vehicle
await supabase.updateVehicle(vehicleId, updates: Partial<Vehicle>);
```

### 💰 Expenses
```typescript
// Get all expenses
const expenses = await supabase.getExpenses();

// Get expenses by vehicle
const expenses = await supabase.getExpensesByVehicle(vehicleId);

// Add expense
await supabase.addExpense({
  vehicle_id: string,
  description: string,
  amount: number,
  currency: 'GBP' | 'NAD' | 'USD',
  category: 'Shipping' | 'Fuel' | 'Tolls' | 'Duty' | 'Food' | 'Repairs',
  location: 'UK' | 'Namibia' | 'Zimbabwe',
  receipt_url?: string
});
```

### 📊 Analytics
```typescript
// Get landed cost summaries
const summaries = await supabase.getLandedCostSummaries();
// Returns: vehicle_id, vin_number, make_model, purchase_price_gbp,
//          total_expenses_usd, total_landed_cost_usd, status
```

### 💵 Financial Records
```typescript
// Get quotes
const quotes = await supabase.getQuotes();

// Get invoices
const invoices = await supabase.getInvoices();

// Get payments
const payments = await supabase.getPayments();

// Add payment
await supabase.addPayment(paymentData);
```

### 👤 Clients
```typescript
// Get all clients
const clients = await supabase.getClients();

// Create client
await supabase.createClient(clientData);

// Update client
await supabase.updateClient(clientId, updates);

// Delete client
await supabase.deleteClient(clientId);
```

### 👷 Employees & Payslips
```typescript
// Get employees
const employees = await supabase.getEmployees();

// Create employee
await supabase.createEmployee(employeeData);

// Update employee
await supabase.updateEmployee(employeeId, updates);

// Delete employee
await supabase.deleteEmployee(employeeId);

// Get payslips
const payslips = await supabase.getPayslips({ employeeId, year, month });

// Generate payslip
await supabase.generatePayslip(payslipData);
```

### 🏢 Company Settings
```typescript
// Get company details
const company = await supabase.getCompanyDetails();

// Update company details
await supabase.updateCompanyDetails({
  name: string,
  registration_no: string,
  tax_id: string,
  address: string,
  contact_email: string
});
```

### 👥 User Management
```typescript
// Get all users
const users = await supabase.getUsers();

// Create user
await supabase.createUser(userData);

// Update user
await supabase.updateUser(userId, updates);

// Delete user
await supabase.deleteUser(userId);

// Reset user password
await supabase.resetUserPassword(email);
```

### ⚙️ Configuration
```typescript
// Get Supabase config
const config = await supabase.getSupabaseConfig();

// Update Supabase config
await supabase.updateSupabaseConfig({
  url: string,
  anonKey: string,
  isConnected: boolean
});
```

---

## 🤖 AI Service

```typescript
import { getLogisticsInsights } from './services/geminiService';

// Get AI insights for fleet data
const insights = await getLogisticsInsights(landedCostSummaries);
// Returns: string with AI-generated business insights
```

---

## 🎯 Error Handling Pattern

All API calls should follow this pattern:

```typescript
try {
  const data = await supabase.someMethod();
  // Handle success
} catch (error) {
  console.error('Error description:', error);
  // Handle error gracefully
}
```

---

## 🔄 Data Flow

1. **Component Mount** → Call `useEffect` → Fetch data with try-catch
2. **User Action** → Call API method → Update state → Refresh UI
3. **Error Occurs** → Catch error → Log to console → Show user feedback

---

## 🛡️ Type Safety

All methods return proper TypeScript types from `types.ts`:
- `Vehicle`
- `Expense`
- `LandedCostSummary`
- `Quote`
- `Invoice`
- `Payment`
- `CompanyDetails`
- `AppUser`
- `AuthSession`
- `SupabaseConfig`

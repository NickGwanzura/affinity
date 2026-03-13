/**
 * Database Service - Neon PostgreSQL
 * 
 * This service handles all database operations using Neon.
 * Supabase is retained for Auth only.
 * 
 * Access control is enforced at the application level since we're not using
 * Supabase RLS. All queries should include appropriate WHERE clauses for
 * user/tenant filtering when needed.
 */

import { sql, isNeonConnected, executeQuery } from './neonClient';
import { 
  Vehicle, 
  Expense, 
  CompanyDetails, 
  AppUser, 
  Quote, 
  QuoteItem,
  Invoice, 
  InvoiceItem,
  Payment, 
  Client, 
  RegistrationRequest,
  Employee,
  Payslip,
  UserInvite,
  UserRole,
  FinancialStatus,
  OperatingFund
} from '../types';
import { EXCHANGE_RATES } from '../constants';

// ============================================
// PAGINATION INTERFACES
// ============================================

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Helper function to safely validate column names for ORDER BY clauses
// Only allows alphanumeric characters and underscores to prevent SQL injection
function validateColumnName(columnName: string, allowedColumns: string[]): string {
  // Remove any characters that aren't alphanumeric, underscore, or period (for table.column)
  const sanitized = columnName.replace(/[^a-zA-Z0-9_.]/g, '');
  // Extract just the column part (after the dot if table.column format)
  const columnPart = sanitized.includes('.') ? sanitized.split('.').pop()! : sanitized;
  
  // Check if the column is in the allowed list (case-insensitive)
  const isAllowed = allowedColumns.some(col => col.toLowerCase() === columnPart.toLowerCase());
  if (!isAllowed) {
    // Return a safe default if not allowed
    return allowedColumns[0];
  }
  return sanitized;
}

// Allowed column names for each table
const VEHICLE_COLUMNS = ['id', 'vin_number', 'make_model', 'purchase_price_gbp', 'status', 'created_at'];
const EXPENSE_COLUMNS = ['id', 'vehicle_id', 'description', 'amount', 'currency', 'category', 'location', 'receipt_url', 'driver_name', 'trip_reference', 'created_at'];
const QUOTE_COLUMNS = ['id', 'quote_number', 'vehicle_id', 'client_name', 'client_email', 'client_address', 'amount_usd', 'status', 'description', 'valid_until', 'created_at'];
const INVOICE_COLUMNS = ['id', 'invoice_number', 'quote_id', 'vehicle_id', 'client_name', 'client_email', 'client_address', 'amount_usd', 'status', 'description', 'due_date', 'created_at'];
const CLIENT_COLUMNS = ['id', 'name', 'email', 'phone', 'address', 'company', 'notes', 'created_at'];
const EMPLOYEE_COLUMNS = ['id', 'employee_number', 'name', 'email', 'phone', 'department', 'position', 'base_pay_usd', 'currency', 'employment_type', 'date_hired', 'status', 'created_at', 'updated_at'];
const PAYSLIP_COLUMNS = ['id', 'payslip_number', 'employee_id', 'month', 'year', 'base_pay', 'gross_pay', 'net_pay', 'status', 'payment_date', 'created_at'];
const FINANCIAL_STATUSES: FinancialStatus[] = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

function normalizeLineItem(item: InvoiceItem, index: number): Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at' | 'updated_at'> {
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unit_price ?? 0);
  const taxRate = Number(item.tax_rate ?? 0);

  return {
    line_number: item.line_number ?? index + 1,
    description: item.description,
    quantity,
    unit_price: unitPrice,
    amount: quantity * unitPrice,
    tax_rate: taxRate,
    tax_amount: (taxRate * quantity * unitPrice) / 100,
    notes: item.notes
  };
}

async function generateUniqueInvoiceNumber(): Promise<string> {
  if (!sql) throw new Error('Database not connected');

  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const candidate = `INV-${year}-${suffix}`;
    const existing = await sql`
      SELECT id
      FROM invoices
      WHERE invoice_number = ${candidate}
      LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return candidate;
    }
  }

  throw new Error('Failed to generate a unique invoice number');
}

// ============================================
// VEHICLES
// ============================================

export async function getVehicles(): Promise<Vehicle[]>;
export async function getVehicles(pagination: PaginationParams): Promise<PaginatedResult<Vehicle>>;
export async function getVehicles(pagination?: PaginationParams): Promise<Vehicle[] | PaginatedResult<Vehicle>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Get total count
      const countResult = await sql`SELECT COUNT(*) as total FROM vehicles`;
      const total = parseInt(countResult[0]?.total || '0');
      
      // Get paginated data
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderColumn = validateColumnName(sortBy, VEHICLE_COLUMNS);
      // Use dangerouslyApply for validated column name since sql tagged template doesn't accept strings for identifiers
      const orderByClause = sql([`${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      const rows = await sql`
        SELECT id, vin_number, make_model, purchase_price_gbp, status, created_at
        FROM vehicles
        ORDER BY ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      return {
        data: rows as Vehicle[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      const rows = await sql`
        SELECT id, vin_number, make_model, purchase_price_gbp, status, created_at
        FROM vehicles
        ORDER BY created_at DESC
      `;
      return rows as Vehicle[];
    }
  }, 'getVehicles');
}

export async function addVehicle(vehicle: Omit<Vehicle, 'id' | 'created_at'>): Promise<Vehicle> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO vehicles (vin_number, make_model, purchase_price_gbp, status)
      VALUES (${vehicle.vin_number}, ${vehicle.make_model}, ${vehicle.purchase_price_gbp}, ${vehicle.status || 'UK'})
      RETURNING id, vin_number, make_model, purchase_price_gbp, status, created_at
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Vehicle insert succeeded but no data returned');
    }
    
    return rows[0] as Vehicle;
  }, 'addVehicle');
}

export async function updateVehicle(vehicleId: string, vehicle: Partial<Omit<Vehicle, 'id' | 'created_at'>>): Promise<Vehicle> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | undefined)[] = [];
    
    if (vehicle.vin_number !== undefined) {
      updates.push('vin_number');
      values.push(vehicle.vin_number);
    }
    if (vehicle.make_model !== undefined) {
      updates.push('make_model');
      values.push(vehicle.make_model);
    }
    if (vehicle.purchase_price_gbp !== undefined) {
      updates.push('purchase_price_gbp');
      values.push(vehicle.purchase_price_gbp);
    }
    if (vehicle.status !== undefined) {
      updates.push('status');
      values.push(vehicle.status);
    }
    
    const rows = await sql`
      UPDATE vehicles
      SET 
        vin_number = COALESCE(${vehicle.vin_number}, vin_number),
        make_model = COALESCE(${vehicle.make_model}, make_model),
        purchase_price_gbp = COALESCE(${vehicle.purchase_price_gbp}, purchase_price_gbp),
        status = COALESCE(${vehicle.status}, status)
      WHERE id = ${vehicleId}::uuid
      RETURNING id, vin_number, make_model, purchase_price_gbp, status, created_at
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Vehicle not found');
    }
    
    return rows[0] as Vehicle;
  }, 'updateVehicle');
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM vehicles WHERE id = ${vehicleId}::uuid`;
  }, 'deleteVehicle');
}

// ============================================
// EXPENSES
// ============================================

export async function getExpenses(): Promise<Expense[]>;
export async function getExpenses(pagination: PaginationParams): Promise<PaginatedResult<Expense>>;
export async function getExpenses(pagination?: PaginationParams): Promise<Expense[] | PaginatedResult<Expense>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Get total count
      const countResult = await sql`SELECT COUNT(*) as total FROM expenses`;
      const total = parseInt(countResult[0]?.total || '0');
      
      // Get paginated data
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderColumn = validateColumnName(sortBy, EXPENSE_COLUMNS);
      const orderByClause = sql([`${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      const rows = await sql`
        SELECT * FROM expenses
        ORDER BY ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      return {
        data: rows as Expense[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      // Use SELECT * to be backward-compatible with databases that don't have driver_name/trip_reference columns yet
      const rows = await sql`
        SELECT * FROM expenses
        ORDER BY created_at DESC
      `;
      return rows as Expense[];
    }
  }, 'getExpenses');
}

export async function getExpensesByVehicle(vehicleId: string): Promise<Expense[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Use SELECT * to be backward-compatible with databases that don't have driver_name/trip_reference columns yet
    const rows = await sql`
      SELECT * FROM expenses
      WHERE vehicle_id = ${vehicleId}::uuid
      ORDER BY created_at DESC
    `;
    return rows as Expense[];
  }, 'getExpensesByVehicle');
}

export async function addExpense(expense: Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>): Promise<Expense> {
  if (!sql) throw new Error('Database not connected');
  
  const exchange_rate_to_usd = EXCHANGE_RATES[expense.currency] || 1;
  
  return executeQuery(async () => {
    // Try with driver_name columns first, fall back to basic insert if columns don't exist
    try {
      const rows = await sql`
        INSERT INTO expenses (vehicle_id, description, amount, currency, exchange_rate_to_usd, category, location, receipt_url, driver_name, trip_reference)
        VALUES (
          ${expense.vehicle_id || null}::uuid, 
          ${expense.description || ''}, 
          ${expense.amount}, 
          ${expense.currency}, 
          ${exchange_rate_to_usd},
          ${expense.category}, 
          ${expense.location}, 
          ${expense.receipt_url || null},
          ${expense.driver_name || null},
          ${expense.trip_reference || null}
        )
        RETURNING *
      `;
      
      if (!rows || rows.length === 0) {
        throw new Error('Expense insert succeeded but no data returned');
      }
      
      return rows[0] as Expense;
    } catch (error: unknown) {
      // If driver_name column doesn't exist, try without it
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('driver_name') || errorMessage.includes('trip_reference')) {
        const rows = await sql`
          INSERT INTO expenses (vehicle_id, description, amount, currency, exchange_rate_to_usd, category, location, receipt_url)
          VALUES (
            ${expense.vehicle_id || null}::uuid, 
            ${expense.description || ''}, 
            ${expense.amount}, 
            ${expense.currency}, 
            ${exchange_rate_to_usd},
            ${expense.category}, 
            ${expense.location}, 
            ${expense.receipt_url || null}
          )
          RETURNING *
        `;
        
        if (!rows || rows.length === 0) {
          throw new Error('Expense insert succeeded but no data returned');
        }
        
        return rows[0] as Expense;
      }
      throw error;
    }
  }, 'addExpense');
}

export async function updateExpense(expenseId: string, updates: Partial<Omit<Expense, 'id' | 'created_at' | 'exchange_rate_to_usd'>>): Promise<Expense> {
  if (!sql) throw new Error('Database not connected');
  
  // Recalculate exchange rate if currency changed
  const exchange_rate_to_usd = updates.currency ? (EXCHANGE_RATES[updates.currency] || 1) : undefined;
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE expenses
      SET 
        vehicle_id = COALESCE(${updates.vehicle_id || null}::uuid, vehicle_id),
        description = COALESCE(${updates.description || null}, description),
        amount = COALESCE(${updates.amount || null}, amount),
        currency = COALESCE(${updates.currency || null}, currency),
        exchange_rate_to_usd = COALESCE(${exchange_rate_to_usd || null}, exchange_rate_to_usd),
        category = COALESCE(${updates.category || null}, category),
        location = COALESCE(${updates.location || null}, location),
        receipt_url = COALESCE(${updates.receipt_url}, receipt_url)
      WHERE id = ${expenseId}::uuid
      RETURNING id, vehicle_id, description, amount, currency, exchange_rate_to_usd, category, location, receipt_url, created_at
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Expense not found');
    }
    
    return rows[0] as Expense;
  }, 'updateExpense');
}

export async function deleteExpense(expenseId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM expenses WHERE id = ${expenseId}::uuid`;
  }, 'deleteExpense');
}

// ============================================
// QUOTES
// ============================================

export async function getQuotes(): Promise<Quote[]>;
export async function getQuotes(pagination: PaginationParams): Promise<PaginatedResult<Quote>>;
export async function getQuotes(pagination?: PaginationParams): Promise<Quote[] | PaginatedResult<Quote>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Get total count
      const countResult = await sql`SELECT COUNT(*) as total FROM quotes`;
      const total = parseInt(countResult[0]?.total || '0');
      
      // Get paginated data - use simple column reference without table prefix for ORDER BY
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderColumn = validateColumnName(sortBy, QUOTE_COLUMNS);
      const orderByClause = sql([`q.${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      const rows = await sql`
        SELECT q.*, 
          (SELECT json_agg(qi.*) FROM quote_items qi WHERE qi.quote_id = q.id) as items
        FROM quotes q
        ORDER BY ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      return {
        data: rows as Quote[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      const rows = await sql`
        SELECT q.*, 
          (SELECT json_agg(qi.*) FROM quote_items qi WHERE qi.quote_id = q.id) as items
        FROM quotes q
        ORDER BY q.created_at DESC
      `;
      return rows as Quote[];
    }
  }, 'getQuotes');
}

export async function createQuote(quoteData: Omit<Quote, 'id' | 'created_at' | 'quote_number'>): Promise<Quote> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Get count for quote number generation
    const countResult = await sql`SELECT COUNT(*) as count FROM quotes`;
    const count = parseInt(countResult[0]?.count || '0');
    const quote_number = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    
    const rows = await sql`
      INSERT INTO quotes (
        quote_number, vehicle_id, client_name, client_email, client_address, 
        amount_usd, status, description, valid_until, items
      )
      VALUES (
        ${quote_number},
        ${quoteData.vehicle_id || null}::uuid,
        ${quoteData.client_name},
        ${quoteData.client_email || null},
        ${quoteData.client_address || null},
        ${quoteData.amount_usd},
        ${quoteData.status || 'Draft'},
        ${quoteData.description || null},
        ${quoteData.valid_until || null},
        ${quoteData.items ? JSON.stringify(quoteData.items) : null}::jsonb
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Quote insert succeeded but no data returned');
    }
    
    return rows[0] as Quote;
  }, 'createQuote');
}

export async function updateQuote(quoteId: string, updates: Partial<Omit<Quote, 'id' | 'created_at' | 'quote_number'>>): Promise<Quote> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE quotes
      SET 
        vehicle_id = COALESCE(${updates.vehicle_id || null}::uuid, vehicle_id),
        client_name = COALESCE(${updates.client_name || null}, client_name),
        client_email = COALESCE(${updates.client_email}, client_email),
        client_address = COALESCE(${updates.client_address}, client_address),
        amount_usd = COALESCE(${updates.amount_usd || null}, amount_usd),
        status = COALESCE(${updates.status || null}, status),
        description = COALESCE(${updates.description}, description),
        valid_until = COALESCE(${updates.valid_until}, valid_until),
        items = COALESCE(${updates.items ? JSON.stringify(updates.items) : null}::jsonb, items)
      WHERE id = ${quoteId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Quote not found');
    }
    
    return rows[0] as Quote;
  }, 'updateQuote');
}

export async function deleteQuote(quoteId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // First delete related quote items
    await sql`DELETE FROM quote_items WHERE quote_id = ${quoteId}::uuid`;
    // Then delete the quote
    await sql`DELETE FROM quotes WHERE id = ${quoteId}::uuid`;
  }, 'deleteQuote');
}

export async function updateQuoteStatus(quoteId: string, status: string): Promise<Quote> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE quotes
      SET status = ${status}
      WHERE id = ${quoteId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Quote not found');
    }
    
    return rows[0] as Quote;
  }, 'updateQuoteStatus');
}

// ============================================
// INVOICES
// ============================================

export async function getInvoices(): Promise<Invoice[]>;
export async function getInvoices(pagination: PaginationParams): Promise<PaginatedResult<Invoice>>;
export async function getInvoices(pagination?: PaginationParams): Promise<Invoice[] | PaginatedResult<Invoice>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Get total count
      const countResult = await sql`SELECT COUNT(*) as total FROM invoices`;
      const total = parseInt(countResult[0]?.total || '0');
      
      // Get paginated data - use simple column reference without table prefix for ORDER BY
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderColumn = validateColumnName(sortBy, INVOICE_COLUMNS);
      const orderByClause = sql([`i.${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      const rows = await sql`
        SELECT i.*,
          COALESCE(
            (SELECT json_agg(ii.* ORDER BY ii.line_number) FROM invoice_items ii WHERE ii.invoice_id = i.id),
            i.items
          ) as items
        FROM invoices i
        ORDER BY ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      return {
        data: rows as Invoice[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      const rows = await sql`
        SELECT i.*,
          COALESCE(
            (SELECT json_agg(ii.* ORDER BY ii.line_number) FROM invoice_items ii WHERE ii.invoice_id = i.id),
            i.items
          ) as items
        FROM invoices i
        ORDER BY i.created_at DESC
      `;
      return rows as Invoice[];
    }
  }, 'getInvoices');
}

export async function createInvoice(invoiceData: Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>): Promise<Invoice> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const invoice_number = await generateUniqueInvoiceNumber();
    const normalizedItems = (invoiceData.items || []).map((item, index) =>
      normalizeLineItem(item as InvoiceItem, index)
    );
    
    const rows = await sql`
      INSERT INTO invoices (
        invoice_number, quote_id, vehicle_id, client_name, client_email, client_address, 
        amount_usd, status, description, notes, terms_and_conditions, due_date, items
      )
      VALUES (
        ${invoice_number},
        ${invoiceData.quote_id || null}::uuid,
        ${invoiceData.vehicle_id || null}::uuid,
        ${invoiceData.client_name},
        ${invoiceData.client_email || null},
        ${invoiceData.client_address || null},
        ${invoiceData.amount_usd},
        ${invoiceData.status || 'Draft'},
        ${invoiceData.description || null},
        ${invoiceData.notes || null},
        ${invoiceData.terms_and_conditions || null},
        ${invoiceData.due_date},
        ${normalizedItems.length > 0 ? JSON.stringify(normalizedItems) : null}::jsonb
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Invoice insert succeeded but no data returned');
    }

    const invoice = rows[0] as Invoice;

    for (const item of normalizedItems) {
      await sql`
        INSERT INTO invoice_items (invoice_id, line_number, description, quantity, unit_price, amount, tax_rate, tax_amount, notes)
        VALUES (
          ${invoice.id}::uuid,
          ${item.line_number || 1},
          ${item.description},
          ${item.quantity},
          ${item.unit_price},
          ${item.amount},
          ${item.tax_rate || 0},
          ${item.tax_amount || 0},
          ${item.notes || null}
        )
      `;
    }
    
    return {
      ...invoice,
      items: normalizedItems as InvoiceItem[]
    };
  }, 'createInvoice');
}

export async function updateInvoice(invoiceId: string, updates: Partial<Omit<Invoice, 'id' | 'created_at' | 'invoice_number'>>): Promise<Invoice> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const normalizedItems = updates.items
      ? updates.items.map((item, index) => normalizeLineItem(item as InvoiceItem, index))
      : null;

    const rows = await sql`
      UPDATE invoices
      SET 
        quote_id = COALESCE(${updates.quote_id || null}::uuid, quote_id),
        vehicle_id = COALESCE(${updates.vehicle_id || null}::uuid, vehicle_id),
        client_name = COALESCE(${updates.client_name || null}, client_name),
        client_email = COALESCE(${updates.client_email}, client_email),
        client_address = COALESCE(${updates.client_address}, client_address),
        amount_usd = COALESCE(${updates.amount_usd || null}, amount_usd),
        status = COALESCE(${updates.status || null}, status),
        description = COALESCE(${updates.description}, description),
        notes = COALESCE(${updates.notes}, notes),
        terms_and_conditions = COALESCE(${updates.terms_and_conditions}, terms_and_conditions),
        due_date = COALESCE(${updates.due_date || null}, due_date),
        items = COALESCE(${normalizedItems ? JSON.stringify(normalizedItems) : null}::jsonb, items)
      WHERE id = ${invoiceId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Invoice not found');
    }

    if (normalizedItems) {
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}::uuid`;

      for (const item of normalizedItems) {
        await sql`
          INSERT INTO invoice_items (invoice_id, line_number, description, quantity, unit_price, amount, tax_rate, tax_amount, notes)
          VALUES (
            ${invoiceId}::uuid,
            ${item.line_number || 1},
            ${item.description},
            ${item.quantity},
            ${item.unit_price},
            ${item.amount},
            ${item.tax_rate || 0},
            ${item.tax_amount || 0},
            ${item.notes || null}
          )
        `;
      }
    }
    
    return {
      ...(rows[0] as Invoice),
      ...(normalizedItems ? { items: normalizedItems as InvoiceItem[] } : {})
    };
  }, 'updateInvoice');
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // First delete related invoice items
    await sql`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}::uuid`;
    // Then delete the invoice
    await sql`DELETE FROM invoices WHERE id = ${invoiceId}::uuid`;
  }, 'deleteInvoice');
}

export async function updateInvoiceStatus(invoiceId: string, status: FinancialStatus): Promise<Invoice> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (!FINANCIAL_STATUSES.includes(status)) {
      throw new Error('Invalid invoice status');
    }

    const rows = await sql`
      UPDATE invoices
      SET status = ${status}
      WHERE id = ${invoiceId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Invoice not found');
    }
    
    return rows[0] as Invoice;
  }, 'updateInvoiceStatus');
}

// ============================================
// PAYMENTS
// ============================================

export async function getPayments(): Promise<Payment[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, reference_id, type, amount_usd, method, date
      FROM payments
      ORDER BY date DESC
    `;
    return rows as Payment[];
  }, 'getPayments');
}

export async function addPayment(payment: Omit<Payment, 'id'>): Promise<Payment> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO payments (reference_id, type, amount_usd, method, date)
      VALUES (
        ${payment.reference_id},
        ${payment.type},
        ${payment.amount_usd},
        ${payment.method || null},
        ${payment.date || new Date().toISOString()}
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Payment insert succeeded but no data returned');
    }
    
    return rows[0] as Payment;
  }, 'addPayment');
}

export async function updatePayment(paymentId: string, updates: Partial<Omit<Payment, 'id'>>): Promise<Payment> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE payments
      SET 
        reference_id = COALESCE(${updates.reference_id || null}, reference_id),
        type = COALESCE(${updates.type || null}, type),
        amount_usd = COALESCE(${updates.amount_usd || null}, amount_usd),
        method = COALESCE(${updates.method}, method),
        date = COALESCE(${updates.date || null}, date)
      WHERE id = ${paymentId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Payment not found');
    }
    
    return rows[0] as Payment;
  }, 'updatePayment');
}

export async function deletePayment(paymentId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM payments WHERE id = ${paymentId}::uuid`;
  }, 'deletePayment');
}

// ============================================
// COMPANY DETAILS
// ============================================

export async function getCompanyDetails(): Promise<CompanyDetails | null> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, name, registration_no, tax_id, contact_email, address, phone, website, logo_url, created_at, updated_at
      FROM company_details
      LIMIT 1
    `;
    
    if (!rows || rows.length === 0) {
      // Return default company if none exists
      return {
        name: "Your Company Name",
        registration_no: "",
        tax_id: "",
        address: "",
        contact_email: "info@company.com"
      } as CompanyDetails;
    }
    
    return rows[0] as CompanyDetails;
  }, 'getCompanyDetails');
}

export async function updateCompanyDetails(details: CompanyDetails): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Check if record exists
    const existing = await sql`SELECT id FROM company_details LIMIT 1`;
    
    if (existing && existing.length > 0) {
      // Update existing record
      await sql`
        UPDATE company_details
        SET 
          name = ${details.name},
          registration_no = ${details.registration_no || ''},
          tax_id = ${details.tax_id || ''},
          contact_email = ${details.contact_email},
          address = ${details.address || ''},
          phone = ${details.phone || ''},
          website = ${details.website || ''},
          logo_url = ${details.logo_url || ''},
          updated_at = NOW()
        WHERE id = ${existing[0].id}::uuid
      `;
    } else {
      // Insert new record
      await sql`
        INSERT INTO company_details (name, registration_no, tax_id, contact_email, address, phone, website, logo_url)
        VALUES (
          ${details.name},
          ${details.registration_no || ''},
          ${details.tax_id || ''},
          ${details.contact_email},
          ${details.address || ''},
          ${details.phone || ''},
          ${details.website || ''},
          ${details.logo_url || ''}
        )
      `;
    }
  }, 'updateCompanyDetails');
}

// ============================================
// USER PROFILES (Database table - Auth handled by Supabase)
// ============================================

export async function getUserProfiles(): Promise<AppUser[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, name, email, role, status, created_at
      FROM user_profiles
      ORDER BY created_at DESC
    `;
    
    return (rows || []).map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as UserRole,
      status: row.status || 'Active'
    })) as AppUser[];
  }, 'getUserProfiles');
}

export async function createUserProfile(userId: string, userData: Omit<AppUser, 'id'>): Promise<AppUser> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO user_profiles (id, name, email, role, status)
      VALUES (
        ${userId}::uuid,
        ${userData.name},
        ${userData.email},
        ${userData.role},
        ${userData.status || 'Active'}
      )
      RETURNING id, name, email, role, status
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('User profile insert succeeded but no data returned');
    }
    
    return rows[0] as AppUser;
  }, 'createUserProfile');
}

export async function updateUserProfile(userId: string, updates: Partial<Omit<AppUser, 'id'>>): Promise<AppUser> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE user_profiles
      SET 
        name = COALESCE(${updates.name || null}, name),
        email = COALESCE(${updates.email || null}, email),
        role = COALESCE(${updates.role || null}, role),
        status = COALESCE(${updates.status || null}, status)
      WHERE id = ${userId}::uuid
      RETURNING id, name, email, role, status
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('User profile not found');
    }
    
    return rows[0] as AppUser;
  }, 'updateUserProfile');
}

export async function deleteUserProfile(userId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM user_profiles WHERE id = ${userId}::uuid`;
  }, 'deleteUserProfile');
}

export async function getUserProfileById(userId: string): Promise<AppUser | null> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, name, email, role, status
      FROM user_profiles
      WHERE id = ${userId}::uuid
    `;
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    return rows[0] as AppUser;
  }, 'getUserProfileById');
}

export async function getUserProfileByEmail(email: string): Promise<AppUser | null> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, name, email, role, status
      FROM user_profiles
      WHERE LOWER(email) = ${email.toLowerCase()}
    `;
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    return rows[0] as AppUser;
  }, 'getUserProfileByEmail');
}

export async function countAdminUsers(): Promise<number> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`SELECT COUNT(*) as count FROM user_profiles WHERE role = 'Admin'`;
    return parseInt(rows[0]?.count || '0');
  }, 'countAdminUsers');
}

// ============================================
// REGISTRATION REQUESTS
// ============================================

export async function getRegistrationRequests(): Promise<RegistrationRequest[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, name, email, role, status, requested_at, reviewed_at, reviewed_by
      FROM registration_requests
      ORDER BY requested_at DESC
    `;
    return rows as RegistrationRequest[];
  }, 'getRegistrationRequests');
}

export async function createRegistrationRequest(data: {
  name: string;
  email: string;
  role: UserRole;
}): Promise<RegistrationRequest> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO registration_requests (name, email, role, password_hash, status, requested_at)
      VALUES (
        ${data.name},
        ${data.email.toLowerCase()},
        ${data.role},
        '',
        'Pending',
        NOW()
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Registration request insert succeeded but no data returned');
    }
    
    return rows[0] as RegistrationRequest;
  }, 'createRegistrationRequest');
}

export async function getRegistrationRequestById(requestId: string): Promise<RegistrationRequest | null> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, name, email, role, status, requested_at, reviewed_at, reviewed_by
      FROM registration_requests
      WHERE id = ${requestId}::uuid
    `;
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    return rows[0] as RegistrationRequest;
  }, 'getRegistrationRequestById');
}

export async function updateRegistrationRequestStatus(
  requestId: string, 
  status: 'Approved' | 'Rejected', 
  reviewedBy: string
): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`
      UPDATE registration_requests
      SET status = ${status}, reviewed_at = NOW(), reviewed_by = ${reviewedBy}
      WHERE id = ${requestId}::uuid
    `;
  }, 'updateRegistrationRequestStatus');
}

// ============================================
// CLIENTS
// ============================================

export async function getClients(): Promise<Client[]>;
export async function getClients(pagination: PaginationParams): Promise<PaginatedResult<Client>>;
export async function getClients(pagination?: PaginationParams): Promise<Client[] | PaginatedResult<Client>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Get total count
      const countResult = await sql`SELECT COUNT(*) as total FROM clients`;
      const total = parseInt(countResult[0]?.total || '0');
      
      // Get paginated data
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderColumn = validateColumnName(sortBy, CLIENT_COLUMNS);
      const orderByClause = sql([`${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      const rows = await sql`
        SELECT id, name, email, phone, address, company, notes, created_at
        FROM clients
        ORDER BY ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      return {
        data: rows as Client[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      const rows = await sql`
        SELECT id, name, email, phone, address, company, notes, created_at
        FROM clients
        ORDER BY created_at DESC
      `;
      return rows as Client[];
    }
  }, 'getClients');
}

export async function createClient(clientData: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO clients (name, email, phone, address, company, notes)
      VALUES (
        ${clientData.name},
        ${clientData.email},
        ${clientData.phone || null},
        ${clientData.address || null},
        ${clientData.company || null},
        ${clientData.notes || null}
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Client insert succeeded but no data returned');
    }
    
    return rows[0] as Client;
  }, 'createClient');
}

export async function updateClient(clientId: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<Client> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE clients
      SET 
        name = COALESCE(${updates.name || null}, name),
        email = COALESCE(${updates.email || null}, email),
        phone = COALESCE(${updates.phone}, phone),
        address = COALESCE(${updates.address}, address),
        company = COALESCE(${updates.company}, company),
        notes = COALESCE(${updates.notes}, notes)
      WHERE id = ${clientId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Client not found');
    }
    
    return rows[0] as Client;
  }, 'updateClient');
}

export async function deleteClient(clientId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM clients WHERE id = ${clientId}::uuid`;
  }, 'deleteClient');
}

export async function checkDuplicateClientEmail(email: string, excludeId?: string): Promise<boolean> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    let rows;
    if (excludeId) {
      rows = await sql`SELECT id FROM clients WHERE email = ${email} AND id != ${excludeId}::uuid`;
    } else {
      rows = await sql`SELECT id FROM clients WHERE email = ${email}`;
    }
    return rows && rows.length > 0;
  }, 'checkDuplicateClientEmail');
}

// ============================================
// EMPLOYEES
// ============================================

export async function getEmployees(): Promise<Employee[]>;
export async function getEmployees(pagination: PaginationParams): Promise<PaginatedResult<Employee>>;
export async function getEmployees(pagination?: PaginationParams): Promise<Employee[] | PaginatedResult<Employee>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Get total count
      const countResult = await sql`SELECT COUNT(*) as total FROM employees`;
      const total = parseInt(countResult[0]?.total || '0');
      
      // Get paginated data
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      const orderColumn = validateColumnName(sortBy, EMPLOYEE_COLUMNS);
      const orderByClause = sql([`${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      const rows = await sql`
        SELECT *
        FROM employees
        ORDER BY ${orderByClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      return {
        data: rows as Employee[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      const rows = await sql`
        SELECT *
        FROM employees
        ORDER BY created_at DESC
      `;
      return rows as Employee[];
    }
  }, 'getEmployees');
}

export async function createEmployee(employeeData: Omit<Employee, 'id' | 'employee_number' | 'created_at' | 'updated_at'>): Promise<Employee> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Generate employee number
    const countResult = await sql`SELECT COUNT(*) as count FROM employees`;
    const count = parseInt(countResult[0]?.count || '0');
    const employee_number = `EMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    
    const rows = await sql`
      INSERT INTO employees (
        employee_number, name, email, phone, department, position, 
        base_pay_usd, currency, employment_type, date_hired, status,
        national_id, bank_account, bank_name, tax_number
      )
      VALUES (
        ${employee_number},
        ${employeeData.name},
        ${employeeData.email},
        ${employeeData.phone || null},
        ${employeeData.department || null},
        ${employeeData.position},
        ${employeeData.base_pay_usd},
        ${employeeData.currency || 'USD'},
        ${employeeData.employment_type || 'Full-time'},
        ${employeeData.date_hired},
        ${employeeData.status || 'Active'},
        ${employeeData.national_id || null},
        ${employeeData.bank_account || null},
        ${employeeData.bank_name || null},
        ${employeeData.tax_number || null}
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Employee insert succeeded but no data returned');
    }
    
    return rows[0] as Employee;
  }, 'createEmployee');
}

export async function updateEmployee(employeeId: string, updates: Partial<Omit<Employee, 'id' | 'employee_number' | 'created_at'>>): Promise<Employee> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE employees
      SET 
        name = COALESCE(${updates.name || null}, name),
        email = COALESCE(${updates.email || null}, email),
        phone = COALESCE(${updates.phone}, phone),
        department = COALESCE(${updates.department}, department),
        position = COALESCE(${updates.position || null}, position),
        base_pay_usd = COALESCE(${updates.base_pay_usd || null}, base_pay_usd),
        currency = COALESCE(${updates.currency || null}, currency),
        employment_type = COALESCE(${updates.employment_type || null}, employment_type),
        date_hired = COALESCE(${updates.date_hired || null}, date_hired),
        status = COALESCE(${updates.status || null}, status),
        national_id = COALESCE(${updates.national_id}, national_id),
        bank_account = COALESCE(${updates.bank_account}, bank_account),
        bank_name = COALESCE(${updates.bank_name}, bank_name),
        tax_number = COALESCE(${updates.tax_number}, tax_number),
        updated_at = NOW()
      WHERE id = ${employeeId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Employee not found');
    }
    
    return rows[0] as Employee;
  }, 'updateEmployee');
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM employees WHERE id = ${employeeId}::uuid`;
  }, 'deleteEmployee');
}

export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`SELECT * FROM employees WHERE id = ${employeeId}::uuid`;
    return rows && rows.length > 0 ? rows[0] as Employee : null;
  }, 'getEmployeeById');
}

// ============================================
// PAYSLIPS
// ============================================

export async function getPayslips(filters?: { employeeId?: string; year?: number; month?: number }): Promise<Payslip[]>;
export async function getPayslips(filters: { employeeId?: string; year?: number; month?: number }, pagination: PaginationParams): Promise<PaginatedResult<Payslip>>;
export async function getPayslips(
  filters?: { employeeId?: string; year?: number; month?: number },
  pagination?: PaginationParams
): Promise<Payslip[] | PaginatedResult<Payslip>> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    if (pagination) {
      const { page, limit, sortBy = 'year', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;
      
      // Build count query based on filters
      let countQuery;
      if (filters?.employeeId && filters?.year && filters?.month) {
        countQuery = await sql`
          SELECT COUNT(*) as total FROM payslips 
          WHERE employee_id = ${filters.employeeId}::uuid 
            AND year = ${filters.year} 
            AND month = ${filters.month}
        `;
      } else if (filters?.employeeId) {
        countQuery = await sql`
          SELECT COUNT(*) as total FROM payslips 
          WHERE employee_id = ${filters.employeeId}::uuid
        `;
      } else if (filters?.year && filters?.month) {
        countQuery = await sql`
          SELECT COUNT(*) as total FROM payslips 
          WHERE year = ${filters.year} AND month = ${filters.month}
        `;
      } else {
        countQuery = await sql`SELECT COUNT(*) as total FROM payslips`;
      }
      const total = parseInt(countQuery[0]?.total || '0');
      
      // Build data query based on filters
      let rows;
      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
      // Handle special case for payslips which has different default sort columns
      const defaultPayslipSort = sortBy === 'year' || sortBy === 'month' ? sortBy : 'year';
      const orderColumn = validateColumnName(defaultPayslipSort, PAYSLIP_COLUMNS);
      
      const orderByClause = sql([`p.${orderColumn} ${orderDirection}`] as unknown as TemplateStringsArray);
      
      if (filters?.employeeId && filters?.year && filters?.month) {
        rows = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          WHERE p.employee_id = ${filters.employeeId}::uuid 
            AND p.year = ${filters.year} 
            AND p.month = ${filters.month}
          ORDER BY ${orderByClause}
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (filters?.employeeId) {
        rows = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          WHERE p.employee_id = ${filters.employeeId}::uuid
          ORDER BY ${orderByClause}
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else if (filters?.year && filters?.month) {
        rows = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          WHERE p.year = ${filters.year} AND p.month = ${filters.month}
          ORDER BY ${orderByClause}
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        rows = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          ORDER BY ${orderByClause}
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
      
      return {
        data: rows as Payslip[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } else {
      // Non-paginated version
      let query;
      
      if (filters?.employeeId && filters?.year && filters?.month) {
        query = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          WHERE p.employee_id = ${filters.employeeId}::uuid 
            AND p.year = ${filters.year} 
            AND p.month = ${filters.month}
          ORDER BY p.year DESC, p.month DESC
        `;
      } else if (filters?.employeeId) {
        query = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          WHERE p.employee_id = ${filters.employeeId}::uuid
          ORDER BY p.year DESC, p.month DESC
        `;
      } else if (filters?.year && filters?.month) {
        query = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          WHERE p.year = ${filters.year} AND p.month = ${filters.month}
          ORDER BY p.year DESC, p.month DESC
        `;
      } else {
        query = await sql`
          SELECT p.*, row_to_json(e.*) as employee
          FROM payslips p
          LEFT JOIN employees e ON p.employee_id = e.id
          ORDER BY p.year DESC, p.month DESC
        `;
      }
      
      return query as Payslip[];
    }
  }, 'getPayslips');
}

export async function generatePayslip(payslipData: {
  employee_id: string;
  month: number;
  year: number;
  base_pay: number;
  overtime_hours?: number;
  overtime_rate?: number;
  bonus?: number;
  allowances?: number;
  commission?: number;
  tax_deduction?: number;
  pension_deduction?: number;
  health_insurance?: number;
  other_deductions?: number;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
  generated_by?: string;
}): Promise<Payslip> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Get employee details
    const employee = await getEmployeeById(payslipData.employee_id);
    if (!employee) throw new Error('Employee not found');
    
    // Calculate payslip values
    const overtime_pay = (payslipData.overtime_hours || 0) * (payslipData.overtime_rate || 0);
    const gross_pay = payslipData.base_pay + overtime_pay + 
      (payslipData.bonus || 0) + (payslipData.allowances || 0) + (payslipData.commission || 0);
    const total_deductions = (payslipData.tax_deduction || 0) + (payslipData.pension_deduction || 0) + 
      (payslipData.health_insurance || 0) + (payslipData.other_deductions || 0);
    const net_pay = gross_pay - total_deductions;
    
    const payslip_number = `PAY-${employee.employee_number}-${String(payslipData.year).padStart(4, '0')}-${String(payslipData.month).padStart(2, '0')}`;
    
    const rows = await sql`
      INSERT INTO payslips (
        payslip_number, employee_id, month, year, base_pay,
        overtime_hours, overtime_rate, overtime_pay, bonus, allowances, commission,
        tax_deduction, pension_deduction, health_insurance, other_deductions,
        gross_pay, total_deductions, net_pay, currency,
        payment_date, payment_method, status, notes, generated_by
      )
      VALUES (
        ${payslip_number},
        ${payslipData.employee_id}::uuid,
        ${payslipData.month},
        ${payslipData.year},
        ${payslipData.base_pay},
        ${payslipData.overtime_hours || 0},
        ${payslipData.overtime_rate || 0},
        ${overtime_pay},
        ${payslipData.bonus || 0},
        ${payslipData.allowances || 0},
        ${payslipData.commission || 0},
        ${payslipData.tax_deduction || 0},
        ${payslipData.pension_deduction || 0},
        ${payslipData.health_insurance || 0},
        ${payslipData.other_deductions || 0},
        ${gross_pay},
        ${total_deductions},
        ${net_pay},
        ${employee.currency},
        ${payslipData.payment_date || null},
        ${payslipData.payment_method || null},
        'Generated',
        ${payslipData.notes || null},
        ${payslipData.generated_by || null}::uuid
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Payslip insert succeeded but no data returned');
    }
    
    // Get the full payslip with employee data
    const fullPayslip = await sql`
      SELECT p.*, row_to_json(e.*) as employee
      FROM payslips p
      LEFT JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ${rows[0].id}::uuid
    `;
    
    return fullPayslip[0] as Payslip;
  }, 'generatePayslip');
}

export async function updatePayslipStatus(payslipId: string, status: 'Generated' | 'Approved' | 'Paid' | 'Cancelled'): Promise<Payslip> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE payslips
      SET status = ${status}
      WHERE id = ${payslipId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Payslip not found');
    }
    
    // Get full payslip with employee
    const fullPayslip = await sql`
      SELECT p.*, row_to_json(e.*) as employee
      FROM payslips p
      LEFT JOIN employees e ON p.employee_id = e.id
      WHERE p.id = ${payslipId}::uuid
    `;
    
    return fullPayslip[0] as Payslip;
  }, 'updatePayslipStatus');
}

export async function deletePayslip(payslipId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM payslips WHERE id = ${payslipId}::uuid`;
  }, 'deletePayslip');
}

// ============================================
// INVITES
// ============================================

export async function getInvites(): Promise<UserInvite[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, email, role, name, status, invited_by, invite_token, expires_at, created_at
      FROM invites
      ORDER BY created_at DESC
    `;
    
    return (rows || []).map(row => ({
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      name: row.name,
      status: row.status as 'Pending' | 'Accepted' | 'Expired',
      invitedBy: row.invited_by,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    })) as UserInvite[];
  }, 'getInvites');
}

export async function createInvite(data: {
  email: string;
  role: UserRole;
  name: string;
  invitedBy: string;
  inviteToken: string;
  expiresAt: string;
}): Promise<UserInvite> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO invites (email, role, name, invited_by, invite_token, expires_at, status)
      VALUES (
        ${data.email},
        ${data.role},
        ${data.name},
        ${data.invitedBy},
        ${data.inviteToken},
        ${data.expiresAt},
        'Pending'
      )
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Invite insert succeeded but no data returned');
    }
    
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      name: row.name,
      status: row.status as 'Pending' | 'Accepted' | 'Expired',
      invitedBy: row.invited_by,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    } as UserInvite;
  }, 'createInvite');
}

export async function getInviteByToken(token: string): Promise<UserInvite | null> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, email, role, name, status, invited_by, invite_token, expires_at, created_at
      FROM invites
      WHERE invite_token = ${token} AND status = 'Pending' AND expires_at > NOW()
    `;
    
    if (!rows || rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      name: row.name,
      status: row.status as 'Pending' | 'Accepted' | 'Expired',
      invitedBy: row.invited_by,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    } as UserInvite;
  }, 'getInviteByToken');
}

export async function updateInviteStatus(inviteId: string, status: 'Accepted' | 'Cancelled'): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`UPDATE invites SET status = ${status} WHERE id = ${inviteId}::uuid`;
  }, 'updateInviteStatus');
}

export async function updateInviteExpiry(inviteId: string, newExpiry: string): Promise<UserInvite> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE invites
      SET expires_at = ${newExpiry}, status = 'Pending'
      WHERE id = ${inviteId}::uuid
      RETURNING *
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Invite not found');
    }
    
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      role: row.role as UserRole,
      name: row.name,
      status: row.status as 'Pending' | 'Accepted' | 'Expired',
      invitedBy: row.invited_by,
      inviteToken: row.invite_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at
    } as UserInvite;
  }, 'updateInviteExpiry');
}

// ============================================
// QUOTE ITEMS
// ============================================

export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT * FROM quote_items WHERE quote_id = ${quoteId}::uuid ORDER BY line_number
    `;
    return (rows || []) as QuoteItem[];
  }, 'getQuoteItems');
}

export async function addQuoteItem(quoteId: string, item: Omit<QuoteItem, 'id' | 'quote_id' | 'created_at' | 'updated_at'>): Promise<QuoteItem> {
  if (!sql) throw new Error('Database not connected');
  
  const amount = item.quantity * item.unit_price;
  const tax_amount = (item.tax_rate || 0) * amount / 100;
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO quote_items (quote_id, line_number, description, quantity, unit_price, amount, tax_rate, tax_amount, notes)
      VALUES (
        ${quoteId}::uuid,
        ${item.line_number || 1},
        ${item.description},
        ${item.quantity},
        ${item.unit_price},
        ${amount},
        ${item.tax_rate || 0},
        ${tax_amount},
        ${item.notes || null}
      )
      RETURNING *
    `;
    return rows[0] as QuoteItem;
  }, 'addQuoteItem');
}

export async function updateQuoteItem(itemId: string, updates: Partial<Omit<QuoteItem, 'id' | 'quote_id' | 'created_at'>>): Promise<QuoteItem> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Get current item to calculate new amounts
    const current = await sql`SELECT * FROM quote_items WHERE id = ${itemId}::uuid`;
    if (!current || current.length === 0) throw new Error('Quote item not found');
    
    const currentItem = current[0] as QuoteItem;
    const quantity = updates.quantity ?? currentItem.quantity;
    const unit_price = updates.unit_price ?? currentItem.unit_price;
    const tax_rate = updates.tax_rate ?? currentItem.tax_rate ?? 0;
    const amount = quantity * unit_price;
    const tax_amount = (tax_rate * amount) / 100;
    
    const rows = await sql`
      UPDATE quote_items
      SET 
        description = COALESCE(${updates.description || null}, description),
        quantity = ${quantity},
        unit_price = ${unit_price},
        amount = ${amount},
        tax_rate = ${tax_rate},
        tax_amount = ${tax_amount},
        line_number = COALESCE(${updates.line_number || null}, line_number),
        notes = COALESCE(${updates.notes}, notes)
      WHERE id = ${itemId}::uuid
      RETURNING *
    `;
    return rows[0] as QuoteItem;
  }, 'updateQuoteItem');
}

export async function deleteQuoteItem(itemId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM quote_items WHERE id = ${itemId}::uuid`;
  }, 'deleteQuoteItem');
}

// ============================================
// INVOICE ITEMS
// ============================================

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}::uuid ORDER BY line_number
    `;
    return (rows || []) as InvoiceItem[];
  }, 'getInvoiceItems');
}

export async function addInvoiceItem(invoiceId: string, item: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at' | 'updated_at'>): Promise<InvoiceItem> {
  if (!sql) throw new Error('Database not connected');
  
  const amount = item.quantity * item.unit_price;
  const tax_amount = (item.tax_rate || 0) * amount / 100;
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO invoice_items (invoice_id, line_number, description, quantity, unit_price, amount, tax_rate, tax_amount, notes)
      VALUES (
        ${invoiceId}::uuid,
        ${item.line_number || 1},
        ${item.description},
        ${item.quantity},
        ${item.unit_price},
        ${amount},
        ${item.tax_rate || 0},
        ${tax_amount},
        ${item.notes || null}
      )
      RETURNING *
    `;
    return rows[0] as InvoiceItem;
  }, 'addInvoiceItem');
}

export async function updateInvoiceItem(itemId: string, updates: Partial<Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at'>>): Promise<InvoiceItem> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    // Get current item to calculate new amounts
    const current = await sql`SELECT * FROM invoice_items WHERE id = ${itemId}::uuid`;
    if (!current || current.length === 0) throw new Error('Invoice item not found');
    
    const currentItem = current[0] as InvoiceItem;
    const quantity = updates.quantity ?? currentItem.quantity;
    const unit_price = updates.unit_price ?? currentItem.unit_price;
    const tax_rate = updates.tax_rate ?? currentItem.tax_rate ?? 0;
    const amount = quantity * unit_price;
    const tax_amount = (tax_rate * amount) / 100;
    
    const rows = await sql`
      UPDATE invoice_items
      SET 
        description = COALESCE(${updates.description || null}, description),
        quantity = ${quantity},
        unit_price = ${unit_price},
        amount = ${amount},
        tax_rate = ${tax_rate},
        tax_amount = ${tax_amount},
        line_number = COALESCE(${updates.line_number || null}, line_number),
        notes = COALESCE(${updates.notes}, notes)
      WHERE id = ${itemId}::uuid
      RETURNING *
    `;
    return rows[0] as InvoiceItem;
  }, 'updateInvoiceItem');
}

export async function deleteInvoiceItem(itemId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM invoice_items WHERE id = ${itemId}::uuid`;
  }, 'deleteInvoiceItem');
}

// ============================================
// OPERATING FUNDS
// ============================================

export async function getOperatingFunds(): Promise<OperatingFund[]> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
      FROM operating_funds
      ORDER BY date DESC, created_at DESC
    `;
    return (rows || []) as OperatingFund[];
  }, 'getOperatingFunds');
}

export async function addOperatingFund(fund: Omit<OperatingFund, 'id' | 'created_at'>): Promise<OperatingFund> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      INSERT INTO operating_funds (type, amount, currency, description, reference, recipient, approved_by, date)
      VALUES (
        ${fund.type},
        ${fund.amount},
        ${fund.currency},
        ${fund.description},
        ${fund.reference || null},
        ${fund.recipient || null},
        ${fund.approved_by || null},
        ${fund.date}
      )
      RETURNING id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Operating fund insert succeeded but no data returned');
    }
    
    return rows[0] as OperatingFund;
  }, 'addOperatingFund');
}

export async function updateOperatingFund(fundId: string, updates: Partial<Omit<OperatingFund, 'id' | 'created_at'>>): Promise<OperatingFund> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      UPDATE operating_funds
      SET 
        type = COALESCE(${updates.type || null}, type),
        amount = COALESCE(${updates.amount || null}, amount),
        currency = COALESCE(${updates.currency || null}, currency),
        description = COALESCE(${updates.description || null}, description),
        reference = COALESCE(${updates.reference}, reference),
        recipient = COALESCE(${updates.recipient}, recipient),
        approved_by = COALESCE(${updates.approved_by}, approved_by),
        date = COALESCE(${updates.date || null}, date)
      WHERE id = ${fundId}::uuid
      RETURNING id, type, amount, currency, description, reference, recipient, approved_by, date, created_at
    `;
    
    if (!rows || rows.length === 0) {
      throw new Error('Operating fund not found or update failed');
    }
    
    return rows[0] as OperatingFund;
  }, 'updateOperatingFund');
}

export async function deleteOperatingFund(fundId: string): Promise<void> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    await sql`DELETE FROM operating_funds WHERE id = ${fundId}::uuid`;
  }, 'deleteOperatingFund');
}

export async function getOperatingFundsBalance(): Promise<{ received: number; disbursed: number; balance: number }> {
  if (!sql) throw new Error('Database not connected');
  
  return executeQuery(async () => {
    const rows = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'Received' THEN amount ELSE 0 END), 0) as received,
        COALESCE(SUM(CASE WHEN type = 'Disbursed' THEN amount ELSE 0 END), 0) as disbursed
      FROM operating_funds
    `;
    
    const received = parseFloat(rows[0]?.received || 0);
    const disbursed = parseFloat(rows[0]?.disbursed || 0);
    
    return {
      received,
      disbursed,
      balance: received - disbursed
    };
  }, 'getOperatingFundsBalance');
}

// Export connection status check
export { isNeonConnected };

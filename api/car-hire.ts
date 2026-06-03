/**
 * /api/car-hire
 *
 * Vehicles
 * GET    /api/car-hire?resource=vehicles          → list vehicles
 * POST   /api/car-hire?resource=vehicles          → add vehicle
 * PUT    /api/car-hire?resource=vehicles&id=<id>  → update vehicle
 * DELETE /api/car-hire?resource=vehicles&id=<id>  → delete vehicle
 *
 * Bookings
 * GET    /api/car-hire?resource=bookings          → list bookings
 * POST   /api/car-hire?resource=bookings          → record hire
 * PUT    /api/car-hire?resource=bookings&id=<id>  → update booking status/payment
 * DELETE /api/car-hire?resource=bookings&id=<id>  → delete booking
 *
 * Expenses
 * GET    /api/car-hire?resource=expenses          → list expenses
 * POST   /api/car-hire?resource=expenses          → add expense
 * DELETE /api/car-hire?resource=expenses&id=<id>  → delete expense
 *
 * Stats
 * GET    /api/car-hire?resource=stats             → monthly KPIs
 * GET    /api/car-hire?resource=monthly           → per-month P&L breakdown
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requireBusinessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { logAuditEvent } from './_audit.js';
import { z } from 'zod';

const json = (res: ApiResponse, status: number, body: unknown) =>
  res.status(status).json(body);

// ── Schemas ──────────────────────────────────────────────────────────────────

const VehicleSchema = z.object({
  make_model:   z.string().min(1).max(200),
  registration: z.string().min(1).max(50),
  year:         z.number().int().min(1990).max(2030).optional(),
  color:        z.string().max(50).optional(),
  daily_rate:   z.number().min(0),
  currency:     z.enum(['USD','GBP','NAD','ZAR','BWP']).default('USD'),
  status:       z.enum(['Available','Hired','Maintenance','Inactive']).default('Available'),
  notes:        z.string().optional(),
});

const BookingSchema = z.object({
  vehicle_id:      z.string().uuid(),
  hirer_name:      z.string().min(1).max(200),
  hirer_phone:     z.string().max(50).optional(),
  hirer_id_number: z.string().max(50).optional(),
  start_date:      z.string(),
  end_date:        z.string(),
  daily_rate:      z.number().min(0),
  total_amount:    z.number().min(0),
  amount_paid:     z.number().min(0).default(0),
  payment_method:  z.string().default('Cash'),
  currency:        z.enum(['USD','GBP','NAD','ZAR','BWP']).default('USD'),
  status:          z.enum(['Confirmed','Active','Completed','Cancelled']).default('Confirmed'),
  notes:           z.string().optional(),
});

const ExpenseSchema = z.object({
  vehicle_id:   z.string().uuid(),
  category:     z.enum(['Fuel','Insurance','Maintenance','Tyres','Licensing','Cleaning','Toll','Other']),
  amount:       z.number().positive(),
  currency:     z.enum(['USD','GBP','NAD','ZAR','BWP']).default('USD'),
  expense_date: z.string().optional(),
  description:  z.string().optional(),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Car Hire', 'Director'])) return;

  const { method, query } = req;
  const resource = typeof query.resource === 'string' ? query.resource : 'stats';
  const id = typeof query.id === 'string' ? query.id : undefined;

  try {
    switch (resource) {
      case 'vehicles': return await handleVehicles(authReq, res, method, id);
      case 'bookings': return await handleBookings(authReq, res, method, id);
      case 'expenses': return await handleExpenses(authReq, res, method, id);
      case 'stats':    return await handleStats(res);
      case 'monthly':  return await handleMonthly(res);
      default:         return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[car-hire]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

async function handleVehicles(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT v.*,
        (SELECT COUNT(*) FROM car_hire_bookings b WHERE b.vehicle_id = v.id AND b.status != 'Cancelled') AS total_hires,
        (SELECT COALESCE(SUM(b.total_amount),0) FROM car_hire_bookings b WHERE b.vehicle_id = v.id AND b.status != 'Cancelled') AS total_income,
        (SELECT COALESCE(SUM(e.amount),0) FROM car_hire_expenses e WHERE e.vehicle_id = v.id) AS total_expenses
      FROM car_hire_vehicles v
      ORDER BY v.make_model ASC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = VehicleSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      INSERT INTO car_hire_vehicles (make_model, registration, year, color, daily_rate, currency, status, notes)
      VALUES (${d.make_model}, ${d.registration}, ${d.year ?? null}, ${d.color ?? null},
              ${d.daily_rate}, ${d.currency}, ${d.status}, ${d.notes ?? null})
      RETURNING *
    `;
    return json(res, 201, row);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = VehicleSchema.partial().safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      UPDATE car_hire_vehicles SET
        make_model   = COALESCE(${d.make_model ?? null}, make_model),
        registration = COALESCE(${d.registration ?? null}, registration),
        year         = COALESCE(${d.year ?? null}, year),
        color        = COALESCE(${d.color ?? null}, color),
        daily_rate   = COALESCE(${d.daily_rate ?? null}, daily_rate),
        currency     = COALESCE(${d.currency ?? null}, currency),
        status       = COALESCE(${d.status ?? null}, status),
        notes        = COALESCE(${d.notes ?? null}, notes),
        updated_at   = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Vehicle not found' });
    return json(res, 200, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    await sql`DELETE FROM car_hire_vehicles WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Bookings ──────────────────────────────────────────────────────────────────

async function handleBookings(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT b.*, v.make_model, v.registration,
             (b.end_date - b.start_date + 1) AS days
      FROM car_hire_bookings b
      LEFT JOIN car_hire_vehicles v ON v.id = b.vehicle_id
      ORDER BY b.start_date DESC, b.created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = BookingSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      INSERT INTO car_hire_bookings
        (vehicle_id, hirer_name, hirer_phone, hirer_id_number, start_date, end_date,
         daily_rate, total_amount, amount_paid, payment_method, currency, status, notes)
      VALUES
        (${d.vehicle_id}, ${d.hirer_name}, ${d.hirer_phone ?? null}, ${d.hirer_id_number ?? null},
         ${d.start_date}, ${d.end_date}, ${d.daily_rate}, ${d.total_amount}, ${d.amount_paid},
         ${d.payment_method}, ${d.currency}, ${d.status}, ${d.notes ?? null})
      RETURNING *
    `;

    // Mark vehicle as Hired if status is Active
    if (d.status === 'Active') {
      await sql`UPDATE car_hire_vehicles SET status = 'Hired', updated_at = NOW() WHERE id = ${d.vehicle_id}`;
    }

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'car_hire.booking.created',
      tableName: 'car_hire_bookings',
      recordId: row.id,
      newData: row,
    });
    return json(res, 201, row);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = BookingSchema.partial().safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      UPDATE car_hire_bookings SET
        hirer_name      = COALESCE(${d.hirer_name ?? null},      hirer_name),
        hirer_phone     = COALESCE(${d.hirer_phone ?? null},     hirer_phone),
        amount_paid     = COALESCE(${d.amount_paid ?? null},     amount_paid),
        payment_method  = COALESCE(${d.payment_method ?? null},  payment_method),
        status          = COALESCE(${d.status ?? null},          status),
        end_date        = COALESCE(${d.end_date ?? null},        end_date),
        notes           = COALESCE(${d.notes ?? null},           notes)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Booking not found' });

    // If completed/cancelled, free up the vehicle
    if (d.status === 'Completed' || d.status === 'Cancelled') {
      if (row.vehicle_id) {
        await sql`UPDATE car_hire_vehicles SET status = 'Available', updated_at = NOW() WHERE id = ${row.vehicle_id}`;
      }
    }

    return json(res, 200, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [booking] = await sql`SELECT * FROM car_hire_bookings WHERE id = ${id}`;
    if (booking?.vehicle_id && booking.status === 'Active') {
      await sql`UPDATE car_hire_vehicles SET status = 'Available', updated_at = NOW() WHERE id = ${booking.vehicle_id}`;
    }
    await sql`DELETE FROM car_hire_bookings WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

async function handleExpenses(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT e.*, v.make_model, v.registration
      FROM car_hire_expenses e
      LEFT JOIN car_hire_vehicles v ON v.id = e.vehicle_id
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = ExpenseSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const expDate = d.expense_date || new Date().toISOString().slice(0, 10);
    const [row] = await sql`
      INSERT INTO car_hire_expenses (vehicle_id, category, amount, currency, expense_date, description)
      VALUES (${d.vehicle_id}, ${d.category}, ${d.amount}, ${d.currency}, ${expDate}, ${d.description ?? null})
      RETURNING *
    `;
    return json(res, 201, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    await sql`DELETE FROM car_hire_expenses WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Stats (current month KPIs) ────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  const [monthIncome] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS value
    FROM car_hire_bookings
    WHERE start_date >= ${monthStart} AND status != 'Cancelled'
  `;
  const [monthExpenses] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM car_hire_expenses
    WHERE expense_date >= ${monthStart}
  `;
  const [monthHires] = await sql`
    SELECT COUNT(*) AS value
    FROM car_hire_bookings
    WHERE start_date >= ${monthStart} AND status != 'Cancelled'
  `;
  const [activeHires] = await sql`
    SELECT COUNT(*) AS value
    FROM car_hire_bookings
    WHERE status = 'Active'
  `;
  const [totalHires] = await sql`
    SELECT COUNT(*) AS value FROM car_hire_bookings WHERE status != 'Cancelled'
  `;
  const [outstandingBalance] = await sql`
    SELECT COALESCE(SUM(total_amount - amount_paid), 0) AS value
    FROM car_hire_bookings WHERE status != 'Cancelled'
  `;

  return res.status(200).json({
    month_income:       Number(monthIncome.value),
    month_expenses:     Number(monthExpenses.value),
    month_net:          Number(monthIncome.value) - Number(monthExpenses.value),
    month_hires:        Number(monthHires.value),
    active_hires:       Number(activeHires.value),
    total_hires:        Number(totalHires.value),
    outstanding_balance: Number(outstandingBalance.value),
  });
}

// ── Monthly P&L breakdown ─────────────────────────────────────────────────────

async function handleMonthly(res: ApiResponse) {
  const incomeByMonth = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', start_date), 'YYYY-MM') AS month,
      COALESCE(SUM(total_amount), 0)                      AS income,
      COUNT(*)                                            AS hires
    FROM car_hire_bookings
    WHERE status != 'Cancelled'
    GROUP BY DATE_TRUNC('month', start_date)
    ORDER BY DATE_TRUNC('month', start_date) DESC
    LIMIT 12
  `;

  const expensesByMonth = await sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', expense_date), 'YYYY-MM') AS month,
      COALESCE(SUM(amount), 0)                              AS expenses
    FROM car_hire_expenses
    GROUP BY DATE_TRUNC('month', expense_date)
    ORDER BY DATE_TRUNC('month', expense_date) DESC
    LIMIT 12
  `;

  // Merge by month
  const expMap: Record<string, number> = {};
  expensesByMonth.forEach((r: any) => { expMap[r.month] = Number(r.expenses); });

  const merged = incomeByMonth.map((r: any) => ({
    month:    r.month,
    income:   Number(r.income),
    expenses: expMap[r.month] ?? 0,
    net:      Number(r.income) - (expMap[r.month] ?? 0),
    hires:    Number(r.hires),
  }));

  return res.status(200).json(merged);
}

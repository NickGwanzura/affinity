import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  AuthenticatedRequest,
  apiError,
  getTenantId,
  handleCors,
  requireRole,
  setSecurityHeaders,
  verifyToken,
} from './_middleware.js';
import { logAuditEvent } from './_audit.js';
import { sql, validateOrderColumn } from './_db.js';
import { ExpenseSchema, ExpenseUpdateSchema, PaginationSchema } from './_schemas.js';

const EXPENSE_COLUMNS = ['id', 'vehicle_id', 'description', 'amount', 'currency', 'category', 'location', 'created_at'];
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  GBP: 1.25,
  NAD: 0.055,
  BWP: 0.073,
  ZAR: 0.055,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;

  try {
    const tenantId = getTenantId(req);
    switch (req.method) {
      case 'GET':
        if (req.query.id) return await getExpense(req, res, tenantId);
        return await listExpenses(req, res, tenantId);
      case 'POST':
        if (!requireRole(authReq, res, ['Admin', 'Accountant', 'Driver'])) return;
        return await createExpense(req, res, tenantId);
      case 'PUT':
        if (!requireRole(authReq, res, ['Admin', 'Accountant', 'Driver'])) return;
        return await updateExpense(req, res, tenantId);
      case 'DELETE':
        if (!requireRole(authReq, res, ['Admin', 'Accountant'])) return;
        return await deleteExpense(req, res, tenantId);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listExpenses(req: VercelRequest, res: VercelResponse, tenantId: string) {
  try {
    const { page, limit, sortBy, sortOrder } = PaginationSchema.parse(req.query);
    const offset = (page - 1) * limit;
    const driverName = typeof req.query.driverName === 'string' ? req.query.driverName.trim() : '';
    const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : '';

    const orderColumn = validateOrderColumn('expenses', sortBy || '') || 'created_at';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    // Tenant isolation
    params.push(tenantId);
    whereClauses.push(`tenant_id = $${params.length}::uuid`);

    if (driverName) {
      params.push(driverName);
      whereClauses.push(`LOWER(TRIM(COALESCE(driver_name, ''))) = LOWER(TRIM($${params.length}::text))`);
    }

    if (vehicleId) {
      params.push(vehicleId);
      whereClauses.push(`vehicle_id = $${params.length}::uuid`);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;
    const countQuery = `SELECT COUNT(*) AS total FROM expenses ${whereClause}`;
    const dataQuery = `
      SELECT *
      FROM expenses
      ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countRows, rows] = await Promise.all([
      sql.query(countQuery, params),
      sql.query(dataQuery, [...params, limit, offset]),
    ]);

    const total = parseInt(String(countRows[0]?.total || '0'), 10);
    return res.status(200).json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return apiError(res, 400, 'Invalid expense query', error);
  }
}

async function getExpense(req: VercelRequest, res: VercelResponse, tenantId: string) {
  const rows = await sql`SELECT * FROM expenses WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid`;
  if (rows.length === 0) return apiError(res, 404, 'Expense not found');
  return res.status(200).json(rows[0]);
}

async function createExpense(req: VercelRequest, res: VercelResponse, tenantId: string) {
  try {
    const authReq = req as AuthenticatedRequest;
    const data = ExpenseSchema.parse(req.body);
    const exchangeRate = data.category === 'Driver Disbursement' ? 1 : (EXCHANGE_RATES[data.currency] || 1);

    try {
      const rows = await sql`
        INSERT INTO expenses (vehicle_id, description, amount, currency, exchange_rate_to_usd, category, location, receipt_url, driver_name, trip_reference, tenant_id)
        VALUES (
          ${data.vehicle_id || null}::uuid,
          ${data.description},
          ${data.amount},
          ${data.currency},
          ${exchangeRate},
          ${data.category},
          ${data.location || null},
          ${data.receipt_url || null},
          ${data.driver_name || null},
          ${data.trip_reference || null},
          ${tenantId}::uuid
        )
        RETURNING *
      `;
      await logAuditEvent({
        req,
        userId: authReq.user?.id || null,
        action: 'expenses.created',
        tableName: 'expenses',
        recordId: rows[0].id,
        newData: rows[0],
      });
      return res.status(201).json(rows[0]);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('driver_name') || error.message.includes('trip_reference'))) {
        const rows = await sql`
          INSERT INTO expenses (vehicle_id, description, amount, currency, exchange_rate_to_usd, category, location, receipt_url, tenant_id)
          VALUES (
            ${data.vehicle_id || null}::uuid,
            ${data.description},
            ${data.amount},
            ${data.currency},
            ${exchangeRate},
            ${data.category},
            ${data.location || null},
            ${data.receipt_url || null},
            ${tenantId}::uuid
          )
          RETURNING *
        `;
        await logAuditEvent({
          req,
          userId: authReq.user?.id || null,
          action: 'expenses.created',
          tableName: 'expenses',
          recordId: rows[0].id,
          newData: rows[0],
        });
        return res.status(201).json(rows[0]);
      }
      throw error;
    }
  } catch (error) {
    return apiError(res, 400, 'Invalid expense data', error);
  }
}

async function updateExpense(req: VercelRequest, res: VercelResponse, tenantId: string) {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.query;
    const data = ExpenseUpdateSchema.parse(req.body);
    const exchangeRate =
      data.currency
        ? (data.category === 'Driver Disbursement' ? 1 : (EXCHANGE_RATES[data.currency] || 1))
        : undefined;

    const existing = await sql`SELECT * FROM expenses WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid`;
    if (existing.length === 0) return apiError(res, 404, 'Expense not found');

    // Drivers can only update their own expenses
    if (authReq.user?.role === 'Driver') {
      const userRows = await sql`SELECT name FROM user_profiles WHERE id = ${authReq.user.id}::uuid LIMIT 1`;
      const userName = userRows[0]?.name;
      if (!userName || existing[0].driver_name !== userName) {
        return res.status(403).json({ error: 'Drivers can only update their own expenses' });
      }
    }

    const rows = await sql`
      UPDATE expenses
      SET
        vehicle_id = COALESCE(${data.vehicle_id ?? null}::uuid, vehicle_id),
        description = COALESCE(${data.description ?? null}, description),
        amount = COALESCE(${data.amount ?? null}, amount),
        currency = COALESCE(${data.currency ?? null}, currency),
        exchange_rate_to_usd = COALESCE(${exchangeRate ?? null}, exchange_rate_to_usd),
        category = COALESCE(${data.category ?? null}, category),
        location = COALESCE(${data.location ?? null}, location),
        receipt_url = COALESCE(${data.receipt_url ?? null}, receipt_url),
        driver_name = COALESCE(${data.driver_name ?? null}, driver_name),
        trip_reference = COALESCE(${data.trip_reference ?? null}, trip_reference)
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      RETURNING *
    `;

    await logAuditEvent({
      req,
      userId: authReq.user?.id || null,
      action: 'expenses.updated',
      tableName: 'expenses',
      recordId: rows[0].id,
      oldData: existing[0],
      newData: rows[0],
    });
    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid expense update', error);
  }
}

async function deleteExpense(req: VercelRequest, res: VercelResponse, tenantId: string) {
  const authReq = req as AuthenticatedRequest;
  const existing = await sql`SELECT * FROM expenses WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid`;
  if (existing.length === 0) return apiError(res, 404, 'Expense not found');
  await logAuditEvent({
    req,
    userId: authReq.user?.id || null,
    action: 'expenses.deleted',
    tableName: 'expenses',
    recordId: existing[0].id,
    oldData: existing[0],
  });
  await sql`DELETE FROM expenses WHERE id = ${req.query.id}::uuid AND tenant_id = ${tenantId}::uuid`;
  return res.status(204).end();
}

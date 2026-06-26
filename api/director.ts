/**
 * /api/director
 *
 * Transactions (director_transactions)
 * GET    /api/director?resource=transactions          → list all transactions
 * POST   /api/director?resource=transactions          → record received/disbursed
 * PUT    /api/director?resource=transactions&id=<id>  → edit transaction
 * DELETE /api/director?resource=transactions&id=<id>  → delete transaction
 *
 * Sales feed (read-only aggregation from Freezit + WiFi Token tables)
 * GET    /api/director?resource=sales                 → combined sales summary
 *
 * Stats
 * GET    /api/director?resource=stats                 → KPI summary
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
  json,
} from './_middleware.js';
import { z } from 'zod';


// ── Schemas ──────────────────────────────────────────────────────────────────

const TransactionSchema = z.object({
  type:        z.enum(['Received', 'Disbursed']),
  amount:      z.number().positive(),
  currency:    z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
  party:       z.string().min(1).max(200),
  purpose:     z.string().min(1).max(300),
  description: z.string().optional(),
  date:        z.string().optional(),
  reference:   z.string().optional(),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Director'])) return;

  const { method, query } = req;
  const resource = typeof query.resource === 'string' ? query.resource : 'stats';
  const id = typeof query.id === 'string' ? query.id : undefined;

  try {
    switch (resource) {
      case 'transactions': return await handleTransactions(authReq, res, method, id);
      case 'sales':        return await handleSalesFeed(res);
      case 'stats':        return await handleStats(res);
      default:             return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[director]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

// ── Transactions ──────────────────────────────────────────────────────────────

async function handleTransactions(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT id, type, amount, currency, party, purpose, description,
             date, recorded_by, reference, created_at
      FROM director_transactions
      ORDER BY date DESC, created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = TransactionSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const txDate = d.date || new Date().toISOString().slice(0, 10);
    const recordedBy = (req as any).user?.name || (req as any).user?.email || 'Director';

    const [row] = await sql`
      INSERT INTO director_transactions
        (type, amount, currency, party, purpose, description, date, recorded_by, reference)
      VALUES
        (${d.type}, ${d.amount}, ${d.currency}, ${d.party}, ${d.purpose},
         ${d.description ?? null}, ${txDate}, ${recordedBy}, ${d.reference ?? null})
      RETURNING *
    `;
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'director.transaction.created',
      tableName: 'director_transactions',
      recordId: row.id,
      newData: row,
    });
    return json(res, 201, row);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = TransactionSchema.partial().safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [oldRow] = await sql`SELECT * FROM director_transactions WHERE id = ${id}`;
    const [row] = await sql`
      UPDATE director_transactions SET
        type        = COALESCE(${d.type ?? null},        type),
        amount      = COALESCE(${d.amount ?? null},      amount),
        currency    = COALESCE(${d.currency ?? null},    currency),
        party       = COALESCE(${d.party ?? null},       party),
        purpose     = COALESCE(${d.purpose ?? null},     purpose),
        description = COALESCE(${d.description ?? null}, description),
        date        = COALESCE(${d.date ?? null},        date),
        reference   = COALESCE(${d.reference ?? null},   reference)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Transaction not found' });
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'director.transaction.updated',
      tableName: 'director_transactions',
      recordId: id,
      oldData: oldRow,
      newData: row,
    });
    return json(res, 200, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [oldRow] = await sql`SELECT * FROM director_transactions WHERE id = ${id}`;
    await sql`DELETE FROM director_transactions WHERE id = ${id}`;
    if (oldRow) {
      await logAuditEvent({
        req,
        userId: req.user?.id || null,
        action: 'director.transaction.deleted',
        tableName: 'director_transactions',
        recordId: id,
        oldData: oldRow,
      });
    }
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Sales Feed ────────────────────────────────────────────────────────────────
// Combined daily sales from Freezit and WiFi Token Sales for director oversight.

async function handleSalesFeed(res: ApiResponse) {
  const freezitSales = await sql`
    SELECT
      s.sale_date   AS date,
      'Freezit'     AS source,
      st.product_name AS item,
      s.qty_sold    AS quantity,
      s.total_sales_value AS total,
      s.payment_method,
      s.notes
    FROM freezit_sales s
    LEFT JOIN freezit_stock st ON st.id = s.stock_id
    ORDER BY s.sale_date DESC, s.created_at DESC
    LIMIT 200
  `;

  const wifiSales = await sql`
    SELECT
      sale_date     AS date,
      'WiFi Tokens' AS source,
      package_type  AS item,
      tokens_sold   AS quantity,
      total_sales   AS total,
      payment_method,
      notes
    FROM wifi_token_sales
    ORDER BY sale_date DESC, created_at DESC
    LIMIT 200
  `;

  const combined = [...freezitSales, ...wifiSales].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return json(res, 200, combined);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [totalReceived] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM director_transactions WHERE type = 'Received'
  `;
  const [totalDisbursed] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM director_transactions WHERE type = 'Disbursed'
  `;
  const [monthReceived] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM director_transactions WHERE type = 'Received' AND date >= ${monthStart}
  `;
  const [monthDisbursed] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS value
    FROM director_transactions WHERE type = 'Disbursed' AND date >= ${monthStart}
  `;
  const [txCount] = await sql`
    SELECT COUNT(*) AS value FROM director_transactions
  `;

  // Sales totals for today and this month
  const [freezitToday] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS value
    FROM freezit_sales WHERE sale_date = ${today}
  `;
  const [wifiToday] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM wifi_token_sales WHERE sale_date = ${today}
  `;
  const [freezitMonth] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS value
    FROM freezit_sales WHERE sale_date >= ${monthStart}
  `;
  const [wifiMonth] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM wifi_token_sales WHERE sale_date >= ${monthStart}
  `;

  return res.status(200).json({
    total_received:   Number(totalReceived.value),
    total_disbursed:  Number(totalDisbursed.value),
    net_balance:      Number(totalReceived.value) - Number(totalDisbursed.value),
    month_received:   Number(monthReceived.value),
    month_disbursed:  Number(monthDisbursed.value),
    tx_count:         Number(txCount.value),
    sales_today:      Number(freezitToday.value) + Number(wifiToday.value),
    sales_this_month: Number(freezitMonth.value) + Number(wifiMonth.value),
  });
}

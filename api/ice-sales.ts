/**
 * /api/ice-sales
 *
 * Sales
 * GET    /api/ice-sales?resource=sales          → list sales
 * POST   /api/ice-sales?resource=sales          → record sale
 * DELETE /api/ice-sales?resource=sales&id=<id>  → delete sale
 *
 * Stats
 * GET    /api/ice-sales?resource=stats          → daily / weekly / monthly KPIs
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

const SaleSchema = z.object({
  sale_date:      z.string().optional(),
  quantity_sold:  z.number().positive(),
  unit_price:     z.number().min(0),
  payment_method: z.string().default('Cash'),
  customer_name:  z.string().optional(),
  notes:          z.string().optional(),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Sales', 'Director'])) return;

  const { method, query } = req;
  const resource = typeof query.resource === 'string' ? query.resource : 'stats';
  const id = typeof query.id === 'string' ? query.id : undefined;

  try {
    switch (resource) {
      case 'sales': return await handleSales(authReq, res, method, id);
      case 'stats': return await handleStats(res);
      default:      return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[ice-sales]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

// ── Sales ─────────────────────────────────────────────────────────────────────

async function handleSales(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT id, sale_date, quantity_sold, unit_price, total_sales,
             payment_method, customer_name, notes, created_at
      FROM ice_sales
      ORDER BY sale_date DESC, created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = SaleSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const saleDate = d.sale_date || new Date().toISOString().slice(0, 10);
      const [row] = await sql`
      INSERT INTO ice_sales (sale_date, quantity_sold, unit_price, payment_method, customer_name, notes)
      VALUES (${saleDate}, ${d.quantity_sold}, ${d.unit_price}, ${d.payment_method},
              ${d.customer_name ?? null}, ${d.notes ?? null})
      RETURNING *
    `;
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'ice_sales.created',
      tableName: 'ice_sales',
      recordId: row.id,
      newData: row,
    });
    return json(res, 201, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    await sql`DELETE FROM ice_sales WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [todaySales] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value,
           COALESCE(SUM(quantity_sold), 0) AS qty
    FROM ice_sales WHERE sale_date = ${today}
  `;
  const [weekSales] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value,
           COALESCE(SUM(quantity_sold), 0) AS qty
    FROM ice_sales WHERE sale_date >= ${weekStartStr}
  `;
  const [monthSales] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value,
           COALESCE(SUM(quantity_sold), 0) AS qty
    FROM ice_sales WHERE sale_date >= ${monthStart}
  `;

  return res.status(200).json({
    today_revenue:    Number(todaySales.value),
    today_quantity:   Number(todaySales.qty),
    week_revenue:     Number(weekSales.value),
    week_quantity:    Number(weekSales.qty),
    month_revenue:    Number(monthSales.value),
    month_quantity:   Number(monthSales.qty),
  });
}

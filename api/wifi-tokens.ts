/**
 * /api/wifi-tokens
 *
 * Sales (wifi_token_sales)
 * GET    /api/wifi-tokens?resource=sales          → list sales
 * POST   /api/wifi-tokens?resource=sales          → record sale
 * DELETE /api/wifi-tokens?resource=sales&id=<id>  → delete sale
 *
 * Monthly costs (wifi_monthly_costs)
 * GET    /api/wifi-tokens?resource=costs           → list monthly costs
 * PUT    /api/wifi-tokens?resource=costs&id=<id>   → update cost entry
 *
 * Stats
 * GET    /api/wifi-tokens?resource=stats           → KPIs + break-even
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

const INTERNET_PACKAGE_FEE = 110;

const json = (res: ApiResponse, status: number, body: unknown) =>
  res.status(status).json(body);

// ── Schemas ──────────────────────────────────────────────────────────────────

const SaleSchema = z.object({
  tokens_sold:    z.number().positive(),
  package_type:   z.string().default('Standard'),
  selling_price:  z.number().positive(),
  payment_method: z.string().default('Cash'),
  sale_date:      z.string().optional(),
  notes:          z.string().optional(),
});

const CostUpdateSchema = z.object({
  amount_usd:  z.number().positive().optional(),
  description: z.string().min(1).optional(),
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
      case 'costs': return await handleCosts(authReq, res, method, id);
      case 'stats': return await handleStats(res);
      default:      return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[wifi-tokens]', err);
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
      SELECT id, sale_date, tokens_sold, package_type, selling_price,
             total_sales, payment_method, notes, created_at
      FROM wifi_token_sales
      ORDER BY sale_date DESC, created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = SaleSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const saleDate = d.sale_date || new Date().toISOString().slice(0, 10);
    const total = d.tokens_sold * d.selling_price;

    // Ensure monthly cost row exists
    const month = new Date().getMonth() + 1;
    const year  = new Date().getFullYear();
    await sql`
      INSERT INTO wifi_monthly_costs (month, year, amount_usd, description)
      VALUES (${month}, ${year}, ${INTERNET_PACKAGE_FEE}, 'Internet Package')
      ON CONFLICT (month, year) DO NOTHING
    `;

    const [sale] = await sql`
      INSERT INTO wifi_token_sales (sale_date, tokens_sold, package_type, selling_price, total_sales, payment_method, notes)
      VALUES (${saleDate}, ${d.tokens_sold}, ${d.package_type}, ${d.selling_price}, ${total}, ${d.payment_method}, ${d.notes ?? null})
      RETURNING *
    `;
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'wifi.sale.created',
      tableName: 'wifi_token_sales',
      recordId: sale.id,
      newData: sale,
    });
    return json(res, 201, sale);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [oldSale] = await sql`SELECT * FROM wifi_token_sales WHERE id = ${id}`;
    await sql`DELETE FROM wifi_token_sales WHERE id = ${id}`;
    if (oldSale) {
      await logAuditEvent({
        req,
        userId: req.user?.id || null,
        action: 'wifi.sale.deleted',
        tableName: 'wifi_token_sales',
        recordId: id,
        oldData: oldSale,
      });
    }
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Monthly costs ─────────────────────────────────────────────────────────────

async function handleCosts(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT id, month, year, amount_usd, description, created_at
      FROM wifi_monthly_costs
      ORDER BY year DESC, month DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = CostUpdateSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      UPDATE wifi_monthly_costs
      SET
        amount_usd  = COALESCE(${d.amount_usd ?? null}, amount_usd),
        description = COALESCE(${d.description ?? null}, description),
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Cost entry not found' });
    return json(res, 200, row);
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

  const [todaySales] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM wifi_token_sales WHERE sale_date = ${today}
  `;
  const [weekSales] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM wifi_token_sales WHERE sale_date >= ${weekStartStr}
  `;
  const [monthSales] = await sql`
    SELECT COALESCE(SUM(total_sales), 0) AS value
    FROM wifi_token_sales WHERE sale_date >= ${monthStart}
  `;

  // Ensure cost row exists
  await sql`
    INSERT INTO wifi_monthly_costs (month, year, amount_usd, description)
    VALUES (${month}, ${year}, ${INTERNET_PACKAGE_FEE}, 'Internet Package')
    ON CONFLICT (month, year) DO NOTHING
  `;
  const [costRow] = await sql`
    SELECT amount_usd FROM wifi_monthly_costs WHERE month = ${month} AND year = ${year}
  `;

  const monthlyCost  = Number(costRow?.amount_usd ?? INTERNET_PACKAGE_FEE);
  const monthRevenue = Number(monthSales.value);
  const netProfit    = monthRevenue - monthlyCost;
  const breakEvenPct = monthlyCost > 0
    ? Math.min(100, (monthRevenue / monthlyCost) * 100)
    : 100;

  return res.status(200).json({
    today:          Number(todaySales.value),
    this_week:      Number(weekSales.value),
    this_month:     monthRevenue,
    net_profit:     netProfit,
    monthly_cost:   monthlyCost,
    break_even_pct: Math.round(breakEvenPct * 10) / 10,
  });
}

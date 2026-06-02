/**
 * /api/freezit
 *
 * Items
 * GET    /api/freezit?resource=items          → list items
 * POST   /api/freezit?resource=items          → create item
 * PUT    /api/freezit?resource=items&id=<id>  → update item
 * DELETE /api/freezit?resource=items&id=<id>  → delete item
 *
 * Sales
 * GET    /api/freezit?resource=sales          → list sales
 * POST   /api/freezit?resource=sales          → record sale (decrements stock)
 * DELETE /api/freezit?resource=sales&id=<id>  → delete sale (restores stock)
 *
 * Restocks
 * GET    /api/freezit?resource=restocks        → list restocks
 * POST   /api/freezit?resource=restocks        → add restock (increments stock)
 * DELETE /api/freezit?resource=restocks&id=<id>→ delete restock (decrements stock)
 *
 * Breakages
 * GET    /api/freezit?resource=breakages       → list breakages
 * POST   /api/freezit?resource=breakages       → record breakage (decrements stock)
 * DELETE /api/freezit?resource=breakages&id=<id>→ delete breakage (restores stock)
 *
 * Stats
 * GET    /api/freezit?resource=stats           → KPI summary
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { z } from 'zod';

const json = (res: ApiResponse, status: number, body: unknown) =>
  res.status(status).json(body);

// ── Schemas ──────────────────────────────────────────────────────────────────

const ItemSchema = z.object({
  name: z.string().min(1).max(200),
  unit_cost: z.number().min(0),
  unit_price: z.number().min(0),
  stock_qty: z.number().int().min(0).default(0),
  currency: z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
});

const SaleSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  currency: z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
  sale_date: z.string().optional(),
  notes: z.string().optional(),
});

const RestockSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().min(0).default(0),
  currency: z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
  restock_date: z.string().optional(),
  notes: z.string().optional(),
});

const BreakageSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.string().optional(),
  breakage_date: z.string().optional(),
  notes: z.string().optional(),
});

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  const { method, query } = req;
  const resource = typeof query.resource === 'string' ? query.resource : 'stats';
  const id = typeof query.id === 'string' ? query.id : undefined;

  try {
    switch (resource) {
      case 'items':     return await handleItems(authReq, res, method, id);
      case 'sales':     return await handleSales(authReq, res, method, id);
      case 'restocks':  return await handleRestocks(authReq, res, method, id);
      case 'breakages': return await handleBreakages(authReq, res, method, id);
      case 'stats':     return await handleStats(res);
      default:          return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[freezit]', err);
    return apiError(res, err);
  }
}

// ── Items ────────────────────────────────────────────────────────────────────

async function handleItems(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT id, name, unit_cost, unit_price, stock_qty, currency, created_at, updated_at
      FROM freezit_items
      ORDER BY name ASC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = ItemSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      INSERT INTO freezit_items (name, unit_cost, unit_price, stock_qty, currency)
      VALUES (${d.name}, ${d.unit_cost}, ${d.unit_price}, ${d.stock_qty}, ${d.currency})
      RETURNING *
    `;
    return json(res, 201, row);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = ItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      UPDATE freezit_items
      SET
        name       = COALESCE(${d.name ?? null}, name),
        unit_cost  = COALESCE(${d.unit_cost ?? null}, unit_cost),
        unit_price = COALESCE(${d.unit_price ?? null}, unit_price),
        stock_qty  = COALESCE(${d.stock_qty ?? null}, stock_qty),
        currency   = COALESCE(${d.currency ?? null}, currency),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Item not found' });
    return json(res, 200, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    await sql`DELETE FROM freezit_items WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Sales ────────────────────────────────────────────────────────────────────

async function handleSales(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT s.id, s.item_id, s.item_name, s.quantity, s.unit_price, s.unit_cost,
             s.total_amount, s.currency, s.sale_date, s.notes, s.created_at
      FROM freezit_sales s
      ORDER BY s.sale_date DESC, s.created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = SaleSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;

    const [item] = await sql`SELECT * FROM freezit_items WHERE id = ${d.item_id}`;
    if (!item) return json(res, 404, { error: 'Item not found' });
    if (item.stock_qty < d.quantity) {
      return json(res, 400, { error: `Insufficient stock. Available: ${item.stock_qty}` });
    }

    const total = d.quantity * d.unit_price;
    const saleDate = d.sale_date || new Date().toISOString().slice(0, 10);

    const [sale] = await sql`
      INSERT INTO freezit_sales (item_id, item_name, quantity, unit_price, unit_cost, total_amount, currency, sale_date, notes)
      VALUES (${d.item_id}, ${item.name}, ${d.quantity}, ${d.unit_price}, ${item.unit_cost}, ${total}, ${d.currency}, ${saleDate}, ${d.notes ?? null})
      RETURNING *
    `;

    await sql`
      UPDATE freezit_items SET stock_qty = stock_qty - ${d.quantity}, updated_at = NOW()
      WHERE id = ${d.item_id}
    `;

    return json(res, 201, sale);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [sale] = await sql`SELECT * FROM freezit_sales WHERE id = ${id}`;
    if (!sale) return json(res, 404, { error: 'Sale not found' });

    if (sale.item_id) {
      await sql`
        UPDATE freezit_items SET stock_qty = stock_qty + ${sale.quantity}, updated_at = NOW()
        WHERE id = ${sale.item_id}
      `;
    }
    await sql`DELETE FROM freezit_sales WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Restocks ─────────────────────────────────────────────────────────────────

async function handleRestocks(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT * FROM freezit_restocks ORDER BY restock_date DESC, created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = RestockSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;

    const [item] = await sql`SELECT * FROM freezit_items WHERE id = ${d.item_id}`;
    if (!item) return json(res, 404, { error: 'Item not found' });

    const total = d.quantity * d.unit_cost;
    const restockDate = d.restock_date || new Date().toISOString().slice(0, 10);

    const [restock] = await sql`
      INSERT INTO freezit_restocks (item_id, item_name, quantity, unit_cost, total_cost, currency, restock_date, notes)
      VALUES (${d.item_id}, ${item.name}, ${d.quantity}, ${d.unit_cost}, ${total}, ${d.currency}, ${restockDate}, ${d.notes ?? null})
      RETURNING *
    `;

    await sql`
      UPDATE freezit_items
      SET stock_qty = stock_qty + ${d.quantity}, unit_cost = ${d.unit_cost}, updated_at = NOW()
      WHERE id = ${d.item_id}
    `;

    return json(res, 201, restock);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [restock] = await sql`SELECT * FROM freezit_restocks WHERE id = ${id}`;
    if (!restock) return json(res, 404, { error: 'Restock not found' });

    if (restock.item_id) {
      await sql`
        UPDATE freezit_items SET stock_qty = GREATEST(0, stock_qty - ${restock.quantity}), updated_at = NOW()
        WHERE id = ${restock.item_id}
      `;
    }
    await sql`DELETE FROM freezit_restocks WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Breakages ────────────────────────────────────────────────────────────────

async function handleBreakages(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT * FROM freezit_breakages ORDER BY breakage_date DESC, created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = BreakageSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;

    const [item] = await sql`SELECT * FROM freezit_items WHERE id = ${d.item_id}`;
    if (!item) return json(res, 404, { error: 'Item not found' });
    if (item.stock_qty < d.quantity) {
      return json(res, 400, { error: `Insufficient stock. Available: ${item.stock_qty}` });
    }

    const loss = d.quantity * Number(item.unit_cost);
    const breakageDate = d.breakage_date || new Date().toISOString().slice(0, 10);

    const [breakage] = await sql`
      INSERT INTO freezit_breakages (item_id, item_name, quantity, unit_cost, estimated_loss, reason, breakage_date, notes)
      VALUES (${d.item_id}, ${item.name}, ${d.quantity}, ${item.unit_cost}, ${loss}, ${d.reason ?? null}, ${breakageDate}, ${d.notes ?? null})
      RETURNING *
    `;

    await sql`
      UPDATE freezit_items SET stock_qty = stock_qty - ${d.quantity}, updated_at = NOW()
      WHERE id = ${d.item_id}
    `;

    return json(res, 201, breakage);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [breakage] = await sql`SELECT * FROM freezit_breakages WHERE id = ${id}`;
    if (!breakage) return json(res, 404, { error: 'Breakage not found' });

    if (breakage.item_id) {
      await sql`
        UPDATE freezit_items SET stock_qty = stock_qty + ${breakage.quantity}, updated_at = NOW()
        WHERE id = ${breakage.item_id}
      `;
    }
    await sql`DELETE FROM freezit_breakages WHERE id = ${id}`;
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Stats ────────────────────────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [todayRev] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS value
    FROM freezit_sales WHERE sale_date = ${today}
  `;
  const [monthRev] = await sql`
    SELECT COALESCE(SUM(total_amount), 0) AS value
    FROM freezit_sales WHERE sale_date >= ${monthStart}
  `;
  const [grossProfit] = await sql`
    SELECT COALESCE(SUM((unit_price - unit_cost) * quantity), 0) AS value
    FROM freezit_sales WHERE sale_date >= ${monthStart}
  `;
  const [stockRemaining] = await sql`
    SELECT COALESCE(SUM(stock_qty), 0) AS value FROM freezit_items
  `;
  const [totalBreakageLoss] = await sql`
    SELECT COALESCE(SUM(estimated_loss), 0) AS value
    FROM freezit_breakages WHERE breakage_date >= ${monthStart}
  `;

  return res.status(200).json({
    today_revenue:   Number(todayRev.value),
    month_revenue:   Number(monthRev.value),
    gross_profit:    Number(grossProfit.value),
    stock_remaining: Number(stockRemaining.value),
    breakage_loss:   Number(totalBreakageLoss.value),
  });
}

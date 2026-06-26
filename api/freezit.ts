/**
 * /api/freezit
 *
 * Stock (freezit_stock)
 * GET    /api/freezit?resource=stock          → list stock items
 * POST   /api/freezit?resource=stock          → add stock item
 * PUT    /api/freezit?resource=stock&id=<id>  → update stock item
 * DELETE /api/freezit?resource=stock&id=<id>  → delete stock item
 *
 * Sales (freezit_sales)
 * GET    /api/freezit?resource=sales          → list sales
 * POST   /api/freezit?resource=sales          → record sale
 * DELETE /api/freezit?resource=sales&id=<id>  → delete sale
 *
 * Restocks (freezit_restock)
 * GET    /api/freezit?resource=restocks       → list restocks
 * POST   /api/freezit?resource=restocks       → record restock
 * DELETE /api/freezit?resource=restocks&id=<id>→ delete restock
 *
 * Breakages (freezit_breakages)
 * GET    /api/freezit?resource=breakages      → list breakages
 * POST   /api/freezit?resource=breakages      → record breakage
 * DELETE /api/freezit?resource=breakages&id=<id>→ delete breakage
 *
 * Stats
 * GET    /api/freezit?resource=stats          → KPI summary
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

const StockSchema = z.object({
  product_name:      z.string().min(1).max(200),
  batch_date:        z.string().optional(),
  opening_qty:       z.number().min(0).default(0),
  received_qty:      z.number().min(0).default(0),
  unit_cost:         z.number().min(0).default(0),
  unit_selling_price: z.number().min(0),
  supplier_name:     z.string().optional(),
  notes:             z.string().optional(),
});

const SaleSchema = z.object({
  stock_id:          z.string().uuid(),
  qty_sold:          z.number().positive(),
  unit_selling_price: z.number().min(0),
  payment_method:    z.string().default('Cash'),
  sale_date:         z.string().optional(),
  notes:             z.string().optional(),
});

const RestockSchema = z.object({
  supplier_name: z.string().optional(),
  qty_received:  z.number().positive(),
  unit_cost:     z.number().min(0).default(0),
  restock_date:  z.string().optional(),
  notes:         z.string().optional(),
});

const BreakageSchema = z.object({
  stock_id:      z.string().uuid(),
  quantity:      z.number().positive(),
  reason:        z.string().optional(),
  breakage_date: z.string().optional(),
  notes:         z.string().optional(),
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
      case 'stock':     return await handleStock(authReq, res, method, id);
      case 'sales':     return await handleSales(authReq, res, method, id);
      case 'restocks':  return await handleRestocks(authReq, res, method, id);
      case 'breakages': return await handleBreakages(authReq, res, method, id);
      case 'stats':     return await handleStats(res);
      default:          return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[freezit]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

// ── Stock ────────────────────────────────────────────────────────────────────

async function handleStock(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT id, product_name, batch_date, opening_qty, received_qty,
             unit_cost, unit_selling_price, damaged_qty, wastage_qty,
             missing_qty, supplier_name, notes, created_at, updated_at,
             (opening_qty + received_qty - COALESCE(damaged_qty,0) - COALESCE(wastage_qty,0) - COALESCE(missing_qty,0)) AS available_qty
      FROM freezit_stock
      ORDER BY created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = StockSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const batchDate = d.batch_date || new Date().toISOString().slice(0, 10);
    const [row] = await sql`
      INSERT INTO freezit_stock
        (product_name, batch_date, opening_qty, received_qty, unit_cost, unit_selling_price, supplier_name, notes)
      VALUES
        (${d.product_name}, ${batchDate}, ${d.opening_qty}, ${d.received_qty}, ${d.unit_cost}, ${d.unit_selling_price}, ${d.supplier_name ?? null}, ${d.notes ?? null})
      RETURNING *
    `;
    return json(res, 201, row);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = StockSchema.partial().safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [row] = await sql`
      UPDATE freezit_stock SET
        product_name       = COALESCE(${d.product_name ?? null}, product_name),
        unit_cost          = COALESCE(${d.unit_cost ?? null}, unit_cost),
        unit_selling_price = COALESCE(${d.unit_selling_price ?? null}, unit_selling_price),
        supplier_name      = COALESCE(${d.supplier_name ?? null}, supplier_name),
        notes              = COALESCE(${d.notes ?? null}, notes),
        updated_at         = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Stock item not found' });
    return json(res, 200, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    await sql`DELETE FROM freezit_stock WHERE id = ${id}`;
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
      SELECT s.id, s.sale_date, s.qty_sold, s.unit_selling_price,
             s.total_sales_value, s.payment_method, s.notes, s.created_at,
             st.product_name
      FROM freezit_sales s
      LEFT JOIN freezit_stock st ON st.id = s.stock_id
      ORDER BY s.sale_date DESC, s.created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = SaleSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const saleDate = d.sale_date || new Date().toISOString().slice(0, 10);
    const total = d.qty_sold * d.unit_selling_price;

    const [sale] = await sql`
      INSERT INTO freezit_sales (stock_id, sale_date, qty_sold, unit_selling_price, total_sales_value, payment_method, notes)
      VALUES (${d.stock_id}, ${saleDate}, ${d.qty_sold}, ${d.unit_selling_price}, ${total}, ${d.payment_method}, ${d.notes ?? null})
      RETURNING *
    `;
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'freezit.sale.created',
      tableName: 'freezit_sales',
      recordId: sale.id,
      newData: sale,
    });
    return json(res, 201, sale);
  }    if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [oldSale] = await sql`SELECT * FROM freezit_sales WHERE id = ${id}`;
    await sql`DELETE FROM freezit_sales WHERE id = ${id}`;
    if (oldSale) {
      await logAuditEvent({
        req,
        userId: req.user?.id || null,
        action: 'freezit.sale.deleted',
        tableName: 'freezit_sales',
        recordId: id,
        oldData: oldSale,
      });
    }
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
      SELECT id, restock_date, supplier_name, qty_received, unit_cost, total_cost, notes, created_at
      FROM freezit_restock
      ORDER BY restock_date DESC, created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = RestockSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const restockDate = d.restock_date || new Date().toISOString().slice(0, 10);
    const total = d.qty_received * d.unit_cost;

    const [row] = await sql`
      INSERT INTO freezit_restock (restock_date, supplier_name, qty_received, unit_cost, total_cost, notes)
      VALUES (${restockDate}, ${d.supplier_name ?? null}, ${d.qty_received}, ${d.unit_cost}, ${total}, ${d.notes ?? null})
      RETURNING *
    `;
    return json(res, 201, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    await sql`DELETE FROM freezit_restock WHERE id = ${id}`;
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
      SELECT b.id, b.product_name, b.quantity, b.unit_cost, b.estimated_loss,
             b.reason, b.breakage_date, b.notes, b.created_at
      FROM freezit_breakages b
      ORDER BY b.breakage_date DESC, b.created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = BreakageSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;

    const [stock] = await sql`SELECT * FROM freezit_stock WHERE id = ${d.stock_id}`;
    if (!stock) return json(res, 404, { error: 'Stock item not found' });

    const loss = d.quantity * Number(stock.unit_cost);
    const breakageDate = d.breakage_date || new Date().toISOString().slice(0, 10);

    const [row] = await sql`
      INSERT INTO freezit_breakages (stock_id, product_name, quantity, unit_cost, estimated_loss, reason, breakage_date, notes)
      VALUES (${d.stock_id}, ${stock.product_name}, ${d.quantity}, ${stock.unit_cost}, ${loss}, ${d.reason ?? null}, ${breakageDate}, ${d.notes ?? null})
      RETURNING *
    `;
    return json(res, 201, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
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
    SELECT COALESCE(SUM(total_sales_value), 0) AS value
    FROM freezit_sales WHERE sale_date = ${today}
  `;
  const [monthRev] = await sql`
    SELECT COALESCE(SUM(total_sales_value), 0) AS value
    FROM freezit_sales WHERE sale_date >= ${monthStart}
  `;
  const [cogs] = await sql`
    SELECT COALESCE(SUM(s.qty_sold * st.unit_cost), 0) AS value
    FROM freezit_sales s
    LEFT JOIN freezit_stock st ON st.id = s.stock_id
    WHERE s.sale_date >= ${monthStart}
  `;
  const [stockTotal] = await sql`
    SELECT COALESCE(SUM(opening_qty + received_qty
      - COALESCE(damaged_qty,0) - COALESCE(wastage_qty,0) - COALESCE(missing_qty,0)), 0) AS value
    FROM freezit_stock
  `;
  const [breakageLoss] = await sql`
    SELECT COALESCE(SUM(estimated_loss), 0) AS value
    FROM freezit_breakages WHERE breakage_date >= ${monthStart}
  `;

  return res.status(200).json({
    today_revenue:   Number(todayRev.value),
    month_revenue:   Number(monthRev.value),
    gross_profit:    Number(monthRev.value) - Number(cogs.value),
    stock_remaining: Number(stockTotal.value),
    breakage_loss:   Number(breakageLoss.value),
  });
}

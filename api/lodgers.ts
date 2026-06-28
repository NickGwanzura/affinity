/**
 * /api/lodgers
 *
 * Lodgers management for Sales/Admin.
 *
 * GET    /api/lodgers?resource=lodgers          → list lodgers
 * POST   /api/lodgers?resource=lodgers          → add lodger
 * PUT    /api/lodgers?resource=lodgers&id=<id>  → update lodger
 * DELETE /api/lodgers?resource=lodgers&id=<id>  → delete lodger (soft)
 *
 * Payments
 * GET    /api/lodgers?resource=payments          → list payments
 * POST   /api/lodgers?resource=payments          → record payment
 * DELETE /api/lodgers?resource=payments&id=<id>  → delete payment
 *
 * Stats
 * GET    /api/lodgers?resource=stats             → occupancy & revenue KPIs
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
import { logAuditEvent } from './_audit.js';


// ── Schemas (matching existing DB schema) ────────────────────────────────────

const LodgerSchema = z.object({
  full_name:               z.string().min(1).max(200),
  phone_number:            z.string().optional(),
  id_number:               z.string().optional(),
  room_number:             z.string().min(1).max(50),
  checkin_date:            z.string().optional(),
  expected_duration_days:  z.number().int().min(1).default(1),
  deposit_amount:          z.number().min(0).default(0),
  amount_paid:             z.number().min(0).default(0),
  checkout_date:           z.string().optional().nullable(),
  status:                  z.enum(['ACTIVE', 'CHECKED_OUT']).default('ACTIVE'),
  notes:                   z.string().optional(),
});

const PaymentSchema = z.object({
  lodger_id:      z.string().uuid(),
  amount:         z.number().positive(),
  currency:       z.string().default('USD'),
  payment_date:   z.string().optional(),
  payment_method: z.string().default('Cash'),
  month_covered:  z.string().optional(),
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
      case 'lodgers':   return await handleLodgers(authReq, res, method, id);
      case 'payments':  return await handlePayments(authReq, res, method, id);
      case 'stats':     return await handleStats(res);
      default:          return json(res, 400, { error: 'Unknown resource' });
    }
  } catch (err) {
    console.error('[lodgers]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

// ── Lodgers ──────────────────────────────────────────────────────────────────

async function handleLodgers(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT l.*,
        COALESCE((SELECT SUM(amount) FROM lodger_payments WHERE lodger_id = l.id), 0) AS total_paid
      FROM lodgers l
      WHERE l.deleted_at IS NULL
      ORDER BY l.checkin_date DESC, l.full_name ASC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = LodgerSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const checkin = d.checkin_date || new Date().toISOString().slice(0, 10);
    const [row] = await sql`
      INSERT INTO lodgers (full_name, phone_number, id_number, room_number, checkin_date,
        expected_duration_days, deposit_amount, amount_paid, checkout_date, status, notes, created_by)
      VALUES (${d.full_name}, ${d.phone_number ?? null}, ${d.id_number ?? null}, ${d.room_number},
        ${checkin}, ${d.expected_duration_days}, ${d.deposit_amount}, ${d.amount_paid},
        ${d.checkout_date ?? null}, ${d.status}, ${d.notes ?? null}, ${req.user?.id || null}::uuid)
      RETURNING *
    `;
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'lodger.created',
      tableName: 'lodgers',
      recordId: row.id,
      newData: row,
    });
    return json(res, 201, row);
  }

  if (method === 'PUT') {
    if (!id) return json(res, 400, { error: 'id required' });
    const parsed = LodgerSchema.partial().safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const [oldRow] = await sql`SELECT * FROM lodgers WHERE id = ${id}`;
    const [row] = await sql`
      UPDATE lodgers SET
        full_name              = COALESCE(${d.full_name ?? null}, full_name),
        phone_number           = COALESCE(${d.phone_number ?? null}, phone_number),
        id_number              = COALESCE(${d.id_number ?? null}, id_number),
        room_number            = COALESCE(${d.room_number ?? null}, room_number),
        checkin_date           = COALESCE(${d.checkin_date ?? null}::date, checkin_date),
        expected_duration_days = COALESCE(${d.expected_duration_days ?? null}, expected_duration_days),
        deposit_amount         = COALESCE(${d.deposit_amount ?? null}, deposit_amount),
        amount_paid            = COALESCE(${d.amount_paid ?? null}, amount_paid),
        checkout_date          = COALESCE(${d.checkout_date ?? null}::date, checkout_date),
        status                 = COALESCE(${d.status ?? null}, status),
        notes                  = COALESCE(${d.notes ?? null}, notes),
        updated_at             = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) return json(res, 404, { error: 'Lodger not found' });
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'lodger.updated',
      tableName: 'lodgers',
      recordId: id,
      oldData: oldRow,
      newData: row,
    });
    return json(res, 200, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [oldRow] = await sql`SELECT * FROM lodgers WHERE id = ${id}`;
    // Soft delete
    await sql`UPDATE lodgers SET deleted_at = NOW(), status = 'CHECKED_OUT', updated_at = NOW() WHERE id = ${id}`;
    if (oldRow) {
      await logAuditEvent({
        req,
        userId: req.user?.id || null,
        action: 'lodger.deleted',
        tableName: 'lodgers',
        recordId: id,
        oldData: oldRow,
      });
    }
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Payments ─────────────────────────────────────────────────────────────────

async function handlePayments(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id: string | undefined,
) {
  if (method === 'GET') {
    const rows = await sql`
      SELECT p.*, l.full_name AS lodger_name, l.room_number
      FROM lodger_payments p
      LEFT JOIN lodgers l ON l.id = p.lodger_id
      ORDER BY p.payment_date DESC, p.created_at DESC
    `;
    return json(res, 200, rows);
  }

  if (method === 'POST') {
    const parsed = PaymentSchema.safeParse(req.body);
    if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
    const d = parsed.data;
    const payDate = d.payment_date || new Date().toISOString().slice(0, 10);
    const [row] = await sql`
      INSERT INTO lodger_payments (lodger_id, amount, currency, payment_date, payment_method, month_covered, notes, created_by)
      VALUES (${d.lodger_id}, ${d.amount}, ${d.currency}, ${payDate}, ${d.payment_method},
              ${d.month_covered ?? null}, ${d.notes ?? null}, ${req.user?.id || null}::uuid)
      RETURNING *
    `;
    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'lodger.payment.created',
      tableName: 'lodger_payments',
      recordId: row.id,
      newData: row,
    });
    return json(res, 201, row);
  }

  if (method === 'DELETE') {
    if (!id) return json(res, 400, { error: 'id required' });
    const [oldRow] = await sql`SELECT * FROM lodger_payments WHERE id = ${id}`;
    await sql`DELETE FROM lodger_payments WHERE id = ${id}`;
    if (oldRow) {
      await logAuditEvent({
        req,
        userId: req.user?.id || null,
        action: 'lodger.payment.deleted',
        tableName: 'lodger_payments',
        recordId: id,
        oldData: oldRow,
      });
    }
    return json(res, 200, { success: true });
  }

  return json(res, 405, { error: 'Method not allowed' });
}

// ── Stats ────────────────────────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const [totalLodgers] = await sql`SELECT COUNT(*) AS value FROM lodgers WHERE status = 'ACTIVE' AND deleted_at IS NULL`;
  const [totalRevenue] = await sql`SELECT COALESCE(SUM(amount), 0) AS value FROM lodger_payments`;
  const [monthRevenue] = await sql`SELECT COALESCE(SUM(amount), 0) AS value FROM lodger_payments WHERE payment_date >= DATE_TRUNC('month', NOW())`;
  const [occupancy] = await sql`SELECT COUNT(*) AS occupied FROM lodgers WHERE status = 'ACTIVE' AND deleted_at IS NULL`;
  const [checkedOut] = await sql`SELECT COUNT(*) AS value FROM lodgers WHERE status = 'CHECKED_OUT'`;

  return res.status(200).json({
    total_lodgers:      Number(totalLodgers.value),
    total_revenue:      Number(totalRevenue.value),
    month_revenue:      Number(monthRevenue.value),
    occupancy:          Number(occupancy.value),
    checked_out:        Number(checkedOut.value),
  });
}

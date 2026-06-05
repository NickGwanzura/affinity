/**
 * /api/rentals
 *
 * GET  ?resource=stats
 * GET  ?resource=units
 * POST ?resource=units
 * PUT  ?resource=units&id=X
 * DELETE ?resource=units&id=X
 *
 * GET  ?resource=tenants
 * POST ?resource=tenants
 * PUT  ?resource=tenants&id=X
 * DELETE ?resource=tenants&id=X
 *
 * GET  ?resource=payments
 * POST ?resource=payments
 * DELETE ?resource=payments&id=X
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
import { logAuditEvent } from './_audit.js';
import { z } from 'zod';

const json = (res: ApiResponse, s: number, b: unknown) => res.status(s).json(b);

const CURRENCIES = ['USD', 'GBP', 'NAD', 'ZAR', 'BWP'] as const;
const STATUSES   = ['available', 'occupied', 'maintenance'] as const;
const METHODS    = ['Cash', 'Bank Transfer', 'EFT', 'Mobile Money', 'Cheque', 'Other'] as const;

const UnitSchema = z.object({
  unit_number:  z.string().min(1).max(50),
  name:         z.string().max(200).optional(),
  location:     z.string().max(200).optional(),
  monthly_rent: z.number().min(0),
  currency:     z.enum(CURRENCIES).default('USD'),
  status:       z.enum(STATUSES).default('available'),
  tenant_id:    z.string().uuid().nullable().optional(),
  start_date:   z.string().optional().nullable(),
  notes:        z.string().max(500).optional(),
});

const TenantSchema = z.object({
  name:          z.string().min(1).max(200),
  business_name: z.string().max(200).optional(),
  phone:         z.string().max(50).optional(),
  email:         z.string().max(200).optional(),
  id_number:     z.string().max(100).optional(),
  notes:         z.string().max(500).optional(),
});

const PaymentSchema = z.object({
  unit_id:        z.string().uuid(),
  tenant_id:      z.string().uuid().nullable().optional(),
  amount:         z.number().positive(),
  currency:       z.enum(CURRENCIES).default('USD'),
  payment_date:   z.string(),
  month_covered:  z.string().min(1),
  payment_method: z.enum(METHODS).default('Cash'),
  notes:          z.string().max(500).optional(),
});

const coerce = (v: unknown) => Number(v) || 0;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  const { method, query } = req;
  const resource = typeof query.resource === 'string' ? query.resource : '';
  const id       = typeof query.id === 'string' ? query.id : undefined;
  const userId   = authReq.user!.id;

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (resource === 'stats') {
        const [units] = await sql`
          SELECT
            COUNT(*)::int                                             AS total_units,
            COUNT(*) FILTER (WHERE status = 'occupied')::int         AS occupied,
            COUNT(*) FILTER (WHERE status = 'available')::int        AS available,
            COUNT(*) FILTER (WHERE status = 'maintenance')::int      AS maintenance,
            COALESCE(SUM(monthly_rent) FILTER (WHERE status = 'occupied'), 0) AS expected_monthly
          FROM shop_units
        `;
        const today = new Date();
        const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const [collected] = await sql`
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM shop_payments WHERE month_covered = ${monthKey}
        `;
        const [arrears] = await sql`
          SELECT COUNT(DISTINCT su.id)::int AS count
          FROM shop_units su
          WHERE su.status = 'occupied'
            AND NOT EXISTS (
              SELECT 1 FROM shop_payments sp
              WHERE sp.unit_id = su.id AND sp.month_covered = ${monthKey}
            )
        `;
        return json(res, 200, {
          total_units:      Number(units.total_units),
          occupied:         Number(units.occupied),
          available:        Number(units.available),
          maintenance:      Number(units.maintenance),
          expected_monthly: coerce(units.expected_monthly),
          collected_this_month: coerce(collected.total),
          arrears_count:    Number(arrears.count),
        });
      }

      if (resource === 'units') {
        const rows = await sql`
          SELECT u.*, t.name AS tenant_name, t.business_name AS tenant_business
          FROM shop_units u
          LEFT JOIN shop_tenants t ON t.id = u.tenant_id
          ORDER BY u.unit_number ASC
        `;
        return json(res, 200, rows.map(r => ({ ...r, monthly_rent: coerce(r.monthly_rent) })));
      }

      if (resource === 'tenants') {
        const rows = await sql`
          SELECT t.*,
            su.unit_number AS unit_number,
            su.name        AS unit_name
          FROM shop_tenants t
          LEFT JOIN shop_units su ON su.tenant_id = t.id
          ORDER BY t.name ASC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'payments') {
        const rows = await sql`
          SELECT sp.*,
            su.unit_number AS unit_number,
            su.name        AS unit_name,
            t.name         AS tenant_name
          FROM shop_payments sp
          JOIN shop_units su ON su.id = sp.unit_id
          LEFT JOIN shop_tenants t ON t.id = sp.tenant_id
          ORDER BY sp.payment_date DESC, sp.created_at DESC
        `;
        return json(res, 200, rows.map(r => ({ ...r, amount: coerce(r.amount) })));
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (method === 'POST') {
      if (resource === 'units') {
        const p = UnitSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO shop_units (unit_number, name, location, monthly_rent, currency, status, tenant_id, start_date, notes)
          VALUES (${d.unit_number}, ${d.name ?? null}, ${d.location ?? null},
                  ${d.monthly_rent}, ${d.currency}, ${d.status},
                  ${d.tenant_id ?? null}, ${d.start_date ?? null}, ${d.notes ?? null})
          RETURNING *
        `;
        if (d.tenant_id) {
          await sql`UPDATE shop_units SET status = 'occupied' WHERE id = ${row.id}::uuid AND status = 'available'`;
        }
        await logAuditEvent({ req, userId, action: 'rental.unit_created', tableName: 'shop_units', recordId: row.id, newData: row });
        return json(res, 201, row);
      }

      if (resource === 'tenants') {
        const p = TenantSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO shop_tenants (name, business_name, phone, email, id_number, notes)
          VALUES (${d.name}, ${d.business_name ?? null}, ${d.phone ?? null},
                  ${d.email ?? null}, ${d.id_number ?? null}, ${d.notes ?? null})
          RETURNING *
        `;
        await logAuditEvent({ req, userId, action: 'rental.tenant_created', tableName: 'shop_tenants', recordId: row.id, newData: row });
        return json(res, 201, row);
      }

      if (resource === 'payments') {
        const p = PaymentSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          INSERT INTO shop_payments (unit_id, tenant_id, amount, currency, payment_date, month_covered, payment_method, notes)
          VALUES (${d.unit_id}::uuid, ${d.tenant_id ?? null}, ${d.amount}, ${d.currency},
                  ${d.payment_date}, ${d.month_covered}, ${d.payment_method}, ${d.notes ?? null})
          RETURNING *
        `;
        await logAuditEvent({ req, userId, action: 'rental.payment_recorded', tableName: 'shop_payments', recordId: row.id, newData: row });
        return json(res, 201, row);
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    // ── PUT ──────────────────────────────────────────────────────────────────
    if (method === 'PUT') {
      if (!id) return json(res, 400, { error: 'id required' });

      if (resource === 'units') {
        const p = UnitSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const effectiveStatus = d.tenant_id ? 'occupied' : (d.status === 'occupied' ? 'available' : d.status);
        const [row] = await sql`
          UPDATE shop_units
          SET unit_number  = ${d.unit_number},
              name         = ${d.name ?? null},
              location     = ${d.location ?? null},
              monthly_rent = ${d.monthly_rent},
              currency     = ${d.currency},
              status       = ${effectiveStatus},
              tenant_id    = ${d.tenant_id ?? null},
              start_date   = ${d.start_date ?? null},
              notes        = ${d.notes ?? null}
          WHERE id = ${id}::uuid
          RETURNING *
        `;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'rental.unit_updated', tableName: 'shop_units', recordId: id, newData: row });
        return json(res, 200, row);
      }

      if (resource === 'tenants') {
        const p = TenantSchema.safeParse(req.body);
        if (!p.success) return json(res, 400, { error: 'Invalid data', details: p.error.issues });
        const d = p.data;
        const [row] = await sql`
          UPDATE shop_tenants
          SET name = ${d.name}, business_name = ${d.business_name ?? null},
              phone = ${d.phone ?? null}, email = ${d.email ?? null},
              id_number = ${d.id_number ?? null}, notes = ${d.notes ?? null}
          WHERE id = ${id}::uuid
          RETURNING *
        `;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'rental.tenant_updated', tableName: 'shop_tenants', recordId: id, newData: row });
        return json(res, 200, row);
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return json(res, 400, { error: 'id required' });

      if (resource === 'units') {
        const [row] = await sql`DELETE FROM shop_units WHERE id = ${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'rental.unit_deleted', tableName: 'shop_units', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }

      if (resource === 'tenants') {
        const [row] = await sql`DELETE FROM shop_tenants WHERE id = ${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'rental.tenant_deleted', tableName: 'shop_tenants', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }

      if (resource === 'payments') {
        const [row] = await sql`DELETE FROM shop_payments WHERE id = ${id}::uuid RETURNING *`;
        if (!row) return json(res, 404, { error: 'Not found' });
        await logAuditEvent({ req, userId, action: 'rental.payment_deleted', tableName: 'shop_payments', recordId: id, oldData: row });
        return json(res, 200, { success: true });
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return apiError(res, 500, 'Internal server error', err);
  }
}

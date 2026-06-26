/**
 * /api/cash-handovers
 *
 * GET  ?resource=my       → my collections (collected_by = me)
 * GET  ?resource=pending  → pending handovers waiting for confirmation
 * GET  ?resource=all      → all handovers (admin only)
 * POST                    → log a new cash collection
 * PUT  ?id=<id>           → confirm receipt (sets received_by, confirmed_at, status)
 * DELETE ?id=<id>         → delete a pending handover (own or admin)
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
  json,
} from './_middleware.js';
import { z } from 'zod';


const CreateSchema = z.object({
  amount:          z.number().positive(),
  currency:        z.enum(['USD', 'GBP', 'NAD', 'ZAR', 'BWP']).default('USD'),
  description:     z.string().min(1).max(500),
  collection_date: z.string().optional(),
});

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
  const access   = authReq.user!.accessRole;
  const isAdmin  = access === 'super_admin' || access === 'admin';

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (resource === 'my') {
        const rows = await sql`
          SELECT h.*,
                 c.name AS collected_by_name,
                 r.name AS received_by_name
          FROM cash_handovers h
          JOIN user_profiles c ON c.id = h.collected_by
          LEFT JOIN user_profiles r ON r.id = h.received_by
          WHERE h.collected_by = ${userId}::uuid
          ORDER BY h.collection_date DESC, h.created_at DESC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'pending') {
        // Any admin/manager sees pending handovers awaiting confirmation
        if (!isAdmin) return json(res, 403, { error: 'Access denied' });
        const rows = await sql`
          SELECT h.*,
                 c.name AS collected_by_name,
                 c.role AS collected_by_role
          FROM cash_handovers h
          JOIN user_profiles c ON c.id = h.collected_by
          WHERE h.status = 'Pending'
          ORDER BY h.collection_date DESC, h.created_at DESC
        `;
        return json(res, 200, rows);
      }

      if (resource === 'all') {
        if (!isAdmin) return json(res, 403, { error: 'Access denied' });
        const rows = await sql`
          SELECT h.*,
                 c.name AS collected_by_name,
                 c.role AS collected_by_role,
                 r.name AS received_by_name
          FROM cash_handovers h
          JOIN user_profiles c ON c.id = h.collected_by
          LEFT JOIN user_profiles r ON r.id = h.received_by
          ORDER BY h.collection_date DESC, h.created_at DESC
        `;
        return json(res, 200, rows);
      }

      return json(res, 400, { error: 'Unknown resource' });
    }

    // ── POST — log a collection ───────────────────────────────────────────────
    if (method === 'POST') {
      const parsed = CreateSchema.safeParse(req.body);
      if (!parsed.success) return json(res, 400, { error: 'Invalid data', details: parsed.error.issues });
      const d = parsed.data;
      const date = d.collection_date || new Date().toISOString().slice(0, 10);

      const [row] = await sql`
        INSERT INTO cash_handovers (collected_by, amount, currency, description, collection_date)
        VALUES (${userId}::uuid, ${d.amount}, ${d.currency}, ${d.description}, ${date})
        RETURNING *
      `;

      await logAuditEvent({
        req,
        userId,
        action:    'cash_handover.created',
        tableName: 'cash_handovers',
        recordId:  row.id,
        newData:   row,
      });

      return json(res, 201, row);
    }

    // ── PUT — confirm receipt ─────────────────────────────────────────────────
    if (method === 'PUT') {
      if (!id) return json(res, 400, { error: 'id required' });
      if (!isAdmin) return json(res, 403, { error: 'Only admins can confirm handovers' });

      const [existing] = await sql`SELECT * FROM cash_handovers WHERE id = ${id}::uuid`;
      if (!existing) return json(res, 404, { error: 'Handover not found' });
      if (existing.status === 'Confirmed') return json(res, 400, { error: 'Already confirmed' });

      const [row] = await sql`
        UPDATE cash_handovers
        SET status       = 'Confirmed',
            received_by  = ${userId}::uuid,
            confirmed_at = NOW(),
            updated_at   = NOW()
        WHERE id = ${id}::uuid
        RETURNING *
      `;

      await logAuditEvent({
        req,
        userId,
        action:    'cash_handover.confirmed',
        tableName: 'cash_handovers',
        recordId:  id,
        oldData:   existing,
        newData:   row,
      });

      return json(res, 200, row);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!id) return json(res, 400, { error: 'id required' });

      const [existing] = await sql`SELECT * FROM cash_handovers WHERE id = ${id}::uuid`;
      if (!existing) return json(res, 404, { error: 'Handover not found' });

      if (existing.collected_by !== userId && !isAdmin) {
        return json(res, 403, { error: 'Access denied' });
      }
      if (existing.status === 'Confirmed' && !isAdmin) {
        return json(res, 400, { error: 'Cannot delete a confirmed handover' });
      }

      await sql`DELETE FROM cash_handovers WHERE id = ${id}::uuid`;

      await logAuditEvent({
        req,
        userId,
        action:    'cash_handover.deleted',
        tableName: 'cash_handovers',
        recordId:  id,
        oldData:   existing,
      });

      return json(res, 200, { success: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return apiError(res, 500, 'Internal server error', err);
  }
}

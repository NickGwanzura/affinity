/**
 * /api/goods-pickup
 *
 * Goods Pickup Request management.
 *
 * Resources:
 *   GET    /api/goods-pickup?resource=requests[&status=xx][&dateFrom=xx][&dateTo=xx]  → list
 *   POST   /api/goods-pickup?resource=requests                                          → create
 *   PUT    /api/goods-pickup?resource=requests&id=xxx                                   → update
 *   DELETE /api/goods-pickup?resource=requests&id=xxx                                   → delete
 *
 *   GET    /api/goods-pickup?resource=items&requestId=xxx                               → list items for a request
 *   POST   /api/goods-pickup?resource=items&requestId=xxx                               → add item
 *   DELETE /api/goods-pickup?resource=items&id=xxx                                      → remove item
 *
 *   GET    /api/goods-pickup?resource=stats                                              → counts & upcoming
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
import { logAuditEvent } from './_audit.js';
import { z } from 'zod';

// ── Zod schemas ────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  pickup_date:    z.string().min(1),
  pickup_address: z.string().min(1).max(500),
  contact_name:   z.string().min(1).max(200),
  contact_phone:  z.string().max(50).optional().default(''),
  notes:          z.string().max(2000).optional().default(''),
  items:          z.array(z.object({
    description: z.string().min(1).max(500),
    quantity:    z.number().int().positive(),
    weight_kg:   z.number().positive().optional().nullable(),
    notes:       z.string().max(500).optional().default(''),
  })).optional().default([]),
});

const RequestUpdateSchema = RequestSchema.partial().omit({ items: true });

const ItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity:    z.number().int().positive(),
  weight_kg:   z.number().positive().optional().nullable(),
  notes:       z.string().max(500).optional().default(''),
});

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireBusinessRole(authReq, res, ['Admin', 'Sales', 'Goods Pickup'])) return;

  const resource = typeof req.query.resource === 'string' ? req.query.resource : 'stats';
  const id = typeof req.query.id === 'string' ? req.query.id : undefined;

  try {
    switch (resource) {
      case 'requests': return await handleRequests(authReq, res, req.method, id, req);
      case 'items':    return await handleItems(authReq, res, req.method, id, req);
      case 'stats':    return await handleStats(res);
      default:         return json(res, 400, { error: `Unknown resource: ${resource}` });
    }
  } catch (err) {
    console.error('[goods-pickup]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

// ── Request handlers ───────────────────────────────────────────────────────

async function handleRequests(authReq: AuthenticatedRequest, res: ApiResponse, method: string, id: string | undefined, req: ApiRequest) {
  switch (method) {
    case 'GET': {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
      const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;

      let query = sql`SELECT r.*, u.name AS requested_by_name
                      FROM goods_pickup_requests r
                      LEFT JOIN user_profiles u ON r.requested_by = u.id
                      WHERE 1=1`;
      if (status)   query = sql`${query} AND r.status = ${status}`;
      if (dateFrom) query = sql`${query} AND r.pickup_date >= ${dateFrom}`;
      if (dateTo)   query = sql`${query} AND r.pickup_date <= ${dateTo}`;
      query = sql`${query} ORDER BY r.pickup_date DESC`;

      const rows = await query;
      return json(res, 200, rows);
    }

    case 'POST': {
      const parsed = RequestSchema.safeParse(req.body);
      if (!parsed.success) return json(res, 400, { error: parsed.error.issues });

      const data = parsed.data;
      // Auto-generate request number: GP-YYYYMMDD-NNN
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seq = await sql`SELECT nextval('goods_pickup_request_number_seq') AS n`;
      const seqNum = String(Number(seq[0]?.n || 1)).padStart(3, '0');
      const requestNumber = `GP-${today}-${seqNum}`;

      const [request] = await sql`
        INSERT INTO goods_pickup_requests (request_number, requested_by, pickup_date, pickup_address, contact_name, contact_phone, notes)
        VALUES (${requestNumber}, ${authReq.user!.id}::uuid, ${data.pickup_date}, ${data.pickup_address}, ${data.contact_name}, ${data.contact_phone || ''}, ${data.notes || ''})
        RETURNING *
      `;

      // Insert items
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          await sql`
            INSERT INTO goods_pickup_items (request_id, description, quantity, weight_kg, notes)
            VALUES (${request.id}::uuid, ${item.description}, ${item.quantity}, ${item.weight_kg ?? null}, ${item.notes || ''})
          `;
        }
      }

      await logAuditEvent({
        userId: authReq.user!.id,
        action: 'CREATE_GOODS_PICKUP_REQUEST',
        tableName: 'goods_pickup_requests',
        recordId: request.id,
        newData: { request_number: requestNumber, pickup_date: data.pickup_date, pickup_address: data.pickup_address },
      });

      return json(res, 201, request);
    }

    case 'PUT': {
      if (!id) return json(res, 400, { error: 'Missing id' });
      const parsed = RequestUpdateSchema.safeParse(req.body);
      if (!parsed.success) return json(res, 400, { error: parsed.error.issues });

      const data = parsed.data;
      const sets: string[] = [];
      const vals: any[] = [];

      if (data.pickup_date !== undefined)    { sets.push('pickup_date = $' + (vals.length + 1)); vals.push(data.pickup_date); }
      if (data.pickup_address !== undefined) { sets.push('pickup_address = $' + (vals.length + 1)); vals.push(data.pickup_address); }
      if (data.contact_name !== undefined)   { sets.push('contact_name = $' + (vals.length + 1)); vals.push(data.contact_name); }
      if (data.contact_phone !== undefined)  { sets.push('contact_phone = $' + (vals.length + 1)); vals.push(data.contact_phone); }
      if (data.status !== undefined)         { sets.push('status = $' + (vals.length + 1)); vals.push(data.status); }
      if (data.notes !== undefined)          { sets.push('notes = $' + (vals.length + 1)); vals.push(data.notes); }

      if (sets.length === 0) return json(res, 400, { error: 'No fields to update' });

      sets.push('updated_at = NOW()');
      vals.push(id);

      const [updated] = await sql`
        UPDATE goods_pickup_requests SET ${sql.unsafe(sets.join(', '))} WHERE id = ${id}::uuid RETURNING *
      `;
      if (!updated) return json(res, 404, { error: 'Request not found' });

      await logAuditEvent({
        userId: authReq.user!.id,
        action: 'UPDATE_GOODS_PICKUP_REQUEST',
        tableName: 'goods_pickup_requests',
        recordId: id,
        newData: data,
      });

      return json(res, 200, updated);
    }

    case 'DELETE': {
      if (!id) return json(res, 400, { error: 'Missing id' });
      await sql`DELETE FROM goods_pickup_requests WHERE id = ${id}::uuid`;
      await logAuditEvent({
        userId: authReq.user!.id,
        action: 'DELETE_GOODS_PICKUP_REQUEST',
        tableName: 'goods_pickup_requests',
        recordId: id,
      });
      return json(res, 200, { success: true });
    }

    default:
      return json(res, 405, { error: 'Method not allowed' });
  }
}

// ── Item handlers ──────────────────────────────────────────────────────────

async function handleItems(authReq: AuthenticatedRequest, res: ApiResponse, method: string, id: string | undefined, req: ApiRequest) {
  switch (method) {
    case 'GET': {
      const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined;
      if (!requestId) return json(res, 400, { error: 'Missing requestId' });
      const rows = await sql`SELECT * FROM goods_pickup_items WHERE request_id = ${requestId}::uuid ORDER BY created_at`;
      return json(res, 200, rows);
    }

    case 'POST': {
      const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : undefined;
      if (!requestId) return json(res, 400, { error: 'Missing requestId' });

      const parsed = ItemSchema.safeParse(req.body);
      if (!parsed.success) return json(res, 400, { error: parsed.error.issues });

      const [item] = await sql`
        INSERT INTO goods_pickup_items (request_id, description, quantity, weight_kg, notes)
        VALUES (${requestId}::uuid, ${parsed.data.description}, ${parsed.data.quantity}, ${parsed.data.weight_kg ?? null}, ${parsed.data.notes || ''})
        RETURNING *
      `;
      return json(res, 201, item);
    }

    case 'DELETE': {
      if (!id) return json(res, 400, { error: 'Missing id' });
      await sql`DELETE FROM goods_pickup_items WHERE id = ${id}::uuid`;
      return json(res, 200, { success: true });
    }

    default:
      return json(res, 405, { error: 'Method not allowed' });
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────

async function handleStats(res: ApiResponse) {
  const now = new Date().toISOString().slice(0, 10);

  const [counts] = await sql`
    SELECT
      COUNT(*)                                             AS total,
      COUNT(*) FILTER (WHERE status = 'Pending')           AS pending,
      COUNT(*) FILTER (WHERE status = 'Confirmed')         AS confirmed,
      COUNT(*) FILTER (WHERE status = 'Collected')         AS collected,
      COUNT(*) FILTER (WHERE status = 'Cancelled')         AS cancelled,
      COUNT(*) FILTER (WHERE status IN ('Pending','Confirmed') AND pickup_date >= ${now}) AS upcoming
    FROM goods_pickup_requests
  `;

  const upcoming = await sql`
    SELECT r.*, u.name AS requested_by_name
    FROM goods_pickup_requests r
    LEFT JOIN user_profiles u ON r.requested_by = u.id
    WHERE r.status IN ('Pending','Confirmed') AND r.pickup_date >= ${now}
    ORDER BY r.pickup_date ASC
    LIMIT 10
  `;

  return json(res, 200, {
    counts: {
      total:     Number(counts.total) || 0,
      pending:   Number(counts.pending) || 0,
      confirmed: Number(counts.confirmed) || 0,
      collected: Number(counts.collected) || 0,
      cancelled: Number(counts.cancelled) || 0,
      upcoming:  Number(counts.upcoming) || 0,
    },
    upcoming,
  });
}

/**
 * /api/public-goods-pickup
 *
 * Public-facing endpoint for UK clients to submit goods pickup requests.
 * NO authentication required — identified by share_token.
 *
 * POST /api/public-goods-pickup          → create a new request (client submits form)
 * GET  /api/public-goods-pickup?token=xxx → view an existing request status
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import { setSecurityHeaders, handleCors, apiError, json } from './_middleware.js';
import { z } from 'zod';
import crypto from 'crypto';

// ── Rate limiting (in-memory, per-IP) ──────────────────────────────────────

const ipCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;   // max requests
const RATE_WIN  = 3600_000; // per hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt <= now) {
    ipCounts.set(ip, { count: 1, resetAt: now + RATE_WIN });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Zod schemas ────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  client_email:   z.string().email().max(200),
  client_name:    z.string().min(1).max(200),
  pickup_date:    z.string().min(1),
  pickup_address: z.string().min(1).max(500),
  contact_phone:  z.string().max(50).optional().default(''),
  notes:          z.string().max(2000).optional().default(''),
  items:          z.array(
    z.object({
      description: z.string().min(1).max(500),
      quantity:    z.number().int().positive(),
    })
  ).optional().default([]),
});

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  try {
    switch (req.method) {
      case 'POST':
        return await createRequest(req, res);
      case 'GET':
        return await getRequest(req, res);
      default:
        return json(res, 405, { error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[public-goods-pickup]', err);
    return apiError(res, 500, 'Internal server error', err);
  }
}

async function createRequest(req: ApiRequest, res: ApiResponse) {
  // Rate limit by IP
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return json(res, 429, { error: 'Too many submissions. Please try again later.' });
  }

  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return json(res, 400, { error: parsed.error.issues.map(i => i.message).join('; ') });
  }

  const data = parsed.data;
  const shareToken = crypto.randomUUID();

  // Auto-generate request number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [seq] = await sql`SELECT nextval('goods_pickup_request_number_seq') AS n`;
  const seqNum = String(Number(seq?.n || 1)).padStart(3, '0');
  const requestNumber = `GP-${today}-${seqNum}`;

  const [request] = await sql`
    INSERT INTO goods_pickup_requests
      (request_number, requested_by, pickup_date, pickup_address, contact_name, contact_phone, notes,
       client_email, share_token, status)
    VALUES
      (${requestNumber}, NULL, ${data.pickup_date}, ${data.pickup_address},
       ${data.client_name}, ${data.contact_phone || ''}, ${data.notes || ''},
       ${data.client_email.toLowerCase()}, ${shareToken}, 'Pending')
    RETURNING id, request_number, share_token, status, created_at
  `;

  // Insert items
  if (data.items.length > 0) {
    for (const item of data.items) {
      await sql`
        INSERT INTO goods_pickup_items (request_id, description, quantity)
        VALUES (${request.id}::uuid, ${item.description}, ${item.quantity})
      `;
    }
  }

  return json(res, 201, {
    request_number: request.request_number,
    share_token:    request.share_token,
    status:         request.status,
    message:        'Your pickup request has been submitted. You will receive a confirmation email.',
  });
}

async function getRequest(req: ApiRequest, res: ApiResponse) {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return json(res, 400, { error: 'Missing token parameter' });

  const [request] = await sql`
    SELECT id, request_number, status, pickup_date, pickup_address,
           contact_name AS client_name, contact_phone, notes, created_at
    FROM goods_pickup_requests
    WHERE share_token = ${token}
  `;

  if (!request) return json(res, 404, { error: 'Request not found' });

  const items = await sql`
    SELECT description, quantity
    FROM goods_pickup_items
    WHERE request_id = ${request.id}::uuid
    ORDER BY created_at
  `;

  return json(res, 200, {
    request_number: request.request_number,
    status:         request.status,
    pickup_date:    request.pickup_date,
    pickup_address: request.pickup_address,
    client_name:    request.client_name,
    contact_phone:  request.contact_phone,
    notes:          request.notes,
    created_at:     request.created_at,
    items:          items.map((i: { description: string; quantity: number }) => ({
                      description: i.description,
                      quantity: i.quantity,
                    })),
  });
}

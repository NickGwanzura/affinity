/**
 * /api/vehicles — Vercel Serverless Function
 *
 * GET    /api/vehicles          → list all vehicles
 * POST   /api/vehicles          → create vehicle
 * PUT    /api/vehicles?id=<id>  → update vehicle
 * DELETE /api/vehicles?id=<id>  → delete vehicle
 *
 * Auth: expects Authorization: Bearer <jwt> header.
 * The JWT is verified server-side using VITE_JWT_SECRET.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_db';

// ─── Auth ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.VITE_JWT_SECRET;

function base64UrlDecode(str: string): string {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + padding, 'base64').toString('utf8');
}

async function verifyJWT(token: string): Promise<{ userId: string; role: string } | null> {
  if (!JWT_SECRET) return null;
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const { createHmac } = await import('crypto');
    const expected = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    if (expected !== signature) return null;

    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

async function authenticate(req: VercelRequest): Promise<{ userId: string; role: string } | null> {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJWT(auth.slice(7));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function requireRole(role: string, required: string[]): boolean {
  return required.includes(role);
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await authenticate(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });

  const { method, query, body } = req;
  const id = typeof query.id === 'string' ? query.id : undefined;

  try {
    // ── GET ─────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const rows = await sql`
        SELECT id, vin_number, make_model, purchase_price_gbp, status, created_at
        FROM vehicles
        ORDER BY created_at DESC
      `;
      return json(res, 200, rows);
    }

    // ── POST ────────────────────────────────────────────────────────────────
    if (method === 'POST') {
      if (!requireRole(user.role, ['Admin', 'Manager'])) {
        return json(res, 403, { error: 'Forbidden' });
      }
      const { vin_number, make_model, purchase_price_gbp, status } = body as Record<string, unknown>;
      if (!vin_number || !make_model || !purchase_price_gbp) {
        return json(res, 400, { error: 'vin_number, make_model, and purchase_price_gbp are required' });
      }
      const [row] = await sql`
        INSERT INTO vehicles (vin_number, make_model, purchase_price_gbp, status, created_at)
        VALUES (
          ${String(vin_number)},
          ${String(make_model)},
          ${Number(purchase_price_gbp)},
          ${String(status ?? 'Available')},
          NOW()
        )
        RETURNING id, vin_number, make_model, purchase_price_gbp, status, created_at
      `;
      return json(res, 201, row);
    }

    // ── PUT ─────────────────────────────────────────────────────────────────
    if (method === 'PUT') {
      if (!requireRole(user.role, ['Admin', 'Manager'])) {
        return json(res, 403, { error: 'Forbidden' });
      }
      if (!id) return json(res, 400, { error: 'id query parameter is required' });

      const { vin_number, make_model, purchase_price_gbp, status } = body as Record<string, unknown>;
      const [row] = await sql`
        UPDATE vehicles SET
          vin_number        = COALESCE(${vin_number != null ? String(vin_number) : null}, vin_number),
          make_model        = COALESCE(${make_model != null ? String(make_model) : null}, make_model),
          purchase_price_gbp = COALESCE(${purchase_price_gbp != null ? Number(purchase_price_gbp) : null}, purchase_price_gbp),
          status            = COALESCE(${status != null ? String(status) : null}, status)
        WHERE id = ${id}
        RETURNING id, vin_number, make_model, purchase_price_gbp, status, created_at
      `;
      if (!row) return json(res, 404, { error: 'Vehicle not found' });
      return json(res, 200, row);
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!requireRole(user.role, ['Admin'])) {
        return json(res, 403, { error: 'Forbidden' });
      }
      if (!id) return json(res, 400, { error: 'id query parameter is required' });

      await sql`DELETE FROM vehicles WHERE id = ${id}`;
      return res.status(204).end();
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json(res, 500, { error: message });
  }
}

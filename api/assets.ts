/* global process */

/**
 * /api/assets — Vercel Serverless Function
 *
 * GET    /api/assets              → list all assets
 * POST   /api/assets              → create asset
 * PUT    /api/assets?id=<id>      → update asset
 * DELETE /api/assets?id=<id>      → delete asset
 *
 * /api/assets/requests           → list all asset requests
 * POST   /api/assets/requests     → create asset request
 * PUT    /api/assets/requests?id=<id> → update asset request
 *
 * Auth: expects Authorization: Bearer <jwt> header.
 * The JWT is verified server-side using JWT_SECRET.
 *
 * Tables are automatically created if they don't exist.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { sql } from './_db.js';

// Auto-create tables if they don't exist
async function ensureTablesExist() {
  // Required by the UUID defaults below on some Postgres setups.
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  // Create assets table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS public.assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      serial_number TEXT,
      status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Under Maintenance', 'Retired')),
      location TEXT,
      purchase_date DATE,
      purchase_value NUMERIC(12, 2),
      condition TEXT DEFAULT 'Good',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create indexes for assets if not exists
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assets_name ON public.assets(name)`;

  // Create asset_requests table if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS public.asset_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
      requested_by TEXT NOT NULL,
      requester_email TEXT,
      requester_department TEXT,
      request_date TIMESTAMPTZ DEFAULT NOW(),
      requested_take_date DATE,
      approved_by TEXT,
      approval_date TIMESTAMPTZ,
      actual_take_date TIMESTAMPTZ,
      expected_return_date DATE,
      actual_return_date TIMESTAMPTZ,
      status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Taken', 'Returned', 'Overdue')),
      rejection_reason TEXT,
      purpose TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create indexes for asset_requests if not exists
  await sql`CREATE INDEX IF NOT EXISTS idx_asset_requests_asset_id ON public.asset_requests(asset_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_asset_requests_status ON public.asset_requests(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_asset_requests_requested_by ON public.asset_requests(requested_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_asset_requests_actual_take_date ON public.asset_requests(actual_take_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_asset_requests_actual_return_date ON public.asset_requests(actual_return_date)`;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;

async function verifyJWT(token: string): Promise<{ userId: string; role: string } | null> {
  if (!JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; role?: string };
    if (typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
      return null;
    }
    return { userId: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

async function authenticate(req: VercelRequest): Promise<{ userId: string; role: string; name: string } | null> {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  const user = await verifyJWT(auth.slice(7));
  if (!user) return null;
  // Get user name from the token or database - for now use a placeholder
  return { ...user, name: 'User' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function requireRole(role: string, required: string[]): boolean {
  return required.includes(role);
}

// ─── Asset Handlers ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = await authenticate(req);
  if (!user) return json(res, 401, { error: 'Unauthorized' });

  // Ensure tables exist
  try {
    await ensureTablesExist();
  } catch (err) {
    console.error('[api/assets] Error creating tables:', err);
  }

  const { method, query, body } = req;
  const id = typeof query.id === 'string' ? query.id : undefined;

  // Check if this is a request for asset_requests
  const path = req.url || '';
  const isRequestsEndpoint = path.includes('/requests');

  try {
    // ── ASSET REQUESTS ENDPOINT ─────────────────────────────────────────────
    if (isRequestsEndpoint) {
      return handleAssetRequests(req, res, user, method, query, body, id);
    }

    // ── ASSETS ENDPOINT ─────────────────────────────────────────────────────
    // ── GET ─────────────────────────────────────────────────────────────────
    if (method === 'GET') {
      // All authenticated users can view assets (Admin, Manager, Accountant)
      const rows = await sql`
        SELECT id, name, description, category, serial_number, status, 
               location, purchase_date, purchase_value, condition, created_at, updated_at
        FROM assets
        ORDER BY created_at DESC
      `;
      return json(res, 200, rows);
    }

    // ── POST ────────────────────────────────────────────────────────────────
    if (method === 'POST') {
      if (!requireRole(user.role, ['Admin', 'Manager'])) {
        return json(res, 403, { error: 'Forbidden' });
      }
      const { name, description, category, serial_number, status, location, purchase_date, purchase_value, condition } = body as Record<string, unknown>;
      if (!name || !category) {
        return json(res, 400, { error: 'name and category are required' });
      }
      const [row] = (await sql`
        INSERT INTO assets (name, description, category, serial_number, status, location, purchase_date, purchase_value, condition, created_at, updated_at)
        VALUES (
          ${String(name)},
          ${description != null ? String(description) : null},
          ${String(category)},
          ${serial_number != null ? String(serial_number) : null},
          ${status != null ? String(status) : 'Available'},
          ${location != null ? String(location) : null},
          ${purchase_date != null ? String(purchase_date) : null},
          ${purchase_value != null ? Number(purchase_value) : null},
          ${condition != null ? String(condition) : 'Good'},
          NOW(),
          NOW()
        )
        RETURNING id, name, description, category, serial_number, status, location, purchase_date, purchase_value, condition, created_at, updated_at
      `) as Record<string, unknown>[];
      return json(res, 201, row);
    }

    // ── PUT ─────────────────────────────────────────────────────────────────
    if (method === 'PUT') {
      if (!requireRole(user.role, ['Admin', 'Manager'])) {
        return json(res, 403, { error: 'Forbidden' });
      }
      if (!id) return json(res, 400, { error: 'id query parameter is required' });

      const { name, description, category, serial_number, status, location, purchase_date, purchase_value, condition } = body as Record<string, unknown>;
      const [row] = (await sql`
        UPDATE assets SET
          name            = COALESCE(${name != null ? String(name) : null}, name),
          description     = COALESCE(${description != null ? String(description) : null}, description),
          category        = COALESCE(${category != null ? String(category) : null}, category),
          serial_number   = COALESCE(${serial_number != null ? String(serial_number) : null}, serial_number),
          status          = COALESCE(${status != null ? String(status) : null}, status),
          location        = COALESCE(${location != null ? String(location) : null}, location),
          purchase_date   = COALESCE(${purchase_date != null ? String(purchase_date) : null}, purchase_date),
          purchase_value  = COALESCE(${purchase_value != null ? Number(purchase_value) : null}, purchase_value),
          condition       = COALESCE(${condition != null ? String(condition) : null}, condition),
          updated_at      = NOW()
        WHERE id = ${id}
        RETURNING id, name, description, category, serial_number, status, location, purchase_date, purchase_value, condition, created_at, updated_at
      `) as Record<string, unknown>[];
      if (!row) return json(res, 404, { error: 'Asset not found' });
      return json(res, 200, row);
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      if (!requireRole(user.role, ['Admin'])) {
        return json(res, 403, { error: 'Forbidden' });
      }
      if (!id) return json(res, 400, { error: 'id query parameter is required' });

      await sql`DELETE FROM assets WHERE id = ${id}`;
      return res.status(204).end();
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[api/assets] Handler error:', err);
    return json(res, 500, { error: message });
  }
}

// ─── Asset Request Handlers ─────────────────────────────────────────────────

async function handleAssetRequests(
  req: VercelRequest, 
  res: VercelResponse, 
  user: { userId: string; role: string; name: string },
  method: string,
  query: Record<string, string | string[] | undefined>,
  body: Record<string, unknown>,
  id?: string
) {
  // ── GET ─────────────────────────────────────────────────────────────────
  if (method === 'GET') {
    // Join with assets to get asset details
    const rows = await sql`
      SELECT 
        ar.id, ar.asset_id, ar.requested_by, ar.requester_email, ar.requester_department,
        ar.request_date, ar.requested_take_date, ar.approved_by, ar.approval_date,
        ar.actual_take_date, ar.expected_return_date, ar.actual_return_date,
        ar.status, ar.rejection_reason, ar.purpose, ar.notes, ar.created_at, ar.updated_at,
        a.name as asset_name, a.category as asset_category, a.serial_number as asset_serial
      FROM asset_requests ar
      LEFT JOIN assets a ON ar.asset_id = a.id
      ORDER BY ar.created_at DESC
    `;
    return json(res, 200, rows);
  }

  // ── POST ────────────────────────────────────────────────────────────────
  if (method === 'POST') {
    if (!requireRole(user.role, ['Admin', 'Manager', 'Accountant'])) {
      return json(res, 403, { error: 'Forbidden' });
    }
    const { 
      asset_id, requested_by, requester_email, requester_department,
      requested_take_date, approved_by, approval_date,
      actual_take_date, expected_return_date, actual_return_date,
      status, rejection_reason, purpose, notes
    } = body as Record<string, unknown>;
    
    if (!asset_id || !requested_by) {
      return json(res, 400, { error: 'asset_id and requested_by are required' });
    }
    
    const [row] = (await sql`
      INSERT INTO asset_requests (
        asset_id, requested_by, requester_email, requester_department,
        request_date, requested_take_date, approved_by, approval_date,
        actual_take_date, expected_return_date, actual_return_date,
        status, rejection_reason, purpose, notes, created_at, updated_at
      )
      VALUES (
        ${String(asset_id)},
        ${String(requested_by)},
        ${requester_email != null ? String(requester_email) : null},
        ${requester_department != null ? String(requester_department) : null},
        NOW(),
        ${requested_take_date != null ? String(requested_take_date) : null},
        ${approved_by != null ? String(approved_by) : null},
        ${approval_date != null ? String(approval_date) : null},
        ${actual_take_date != null ? String(actual_take_date) : null},
        ${expected_return_date != null ? String(expected_return_date) : null},
        ${actual_return_date != null ? String(actual_return_date) : null},
        ${status != null ? String(status) : 'Pending'},
        ${rejection_reason != null ? String(rejection_reason) : null},
        ${purpose != null ? String(purpose) : null},
        ${notes != null ? String(notes) : null},
        NOW(),
        NOW()
      )
      RETURNING id, asset_id, requested_by, requester_email, requester_department,
                request_date, requested_take_date, approved_by, approval_date,
                actual_take_date, expected_return_date, actual_return_date,
                status, rejection_reason, purpose, notes, created_at, updated_at
    `) as Record<string, unknown>[];

    // If status is 'Taken', update the asset status to 'Borrowed'
    if (status === 'Taken' && asset_id) {
      await sql`UPDATE assets SET status = 'Borrowed', updated_at = NOW() WHERE id = ${String(asset_id)}`;
    }
    
    return json(res, 201, row);
  }

  // ── PUT ─────────────────────────────────────────────────────────────────
  if (method === 'PUT') {
    if (!requireRole(user.role, ['Admin', 'Manager'])) {
      return json(res, 403, { error: 'Forbidden' });
    }
    if (!id) return json(res, 400, { error: 'id query parameter is required' });

    const { 
      asset_id, requested_by, requester_email, requester_department,
      requested_take_date, approved_by, approval_date,
      actual_take_date, expected_return_date, actual_return_date,
      status, rejection_reason, purpose, notes
    } = body as Record<string, unknown>;
    
    // First get the current request to check status changes
    const [currentRequest] = (await sql`
      SELECT asset_id, status FROM asset_requests WHERE id = ${id}
    `) as Record<string, unknown>[];
    
    if (!currentRequest) {
      return json(res, 404, { error: 'Asset request not found' });
    }
    
    const [row] = (await sql`
      UPDATE asset_requests SET
        asset_id             = COALESCE(${asset_id != null ? String(asset_id) : null}, asset_id),
        requested_by         = COALESCE(${requested_by != null ? String(requested_by) : null}, requested_by),
        requester_email      = COALESCE(${requester_email != null ? String(requester_email) : null}, requester_email),
        requester_department = COALESCE(${requester_department != null ? String(requester_department) : null}, requester_department),
        requested_take_date  = COALESCE(${requested_take_date != null ? String(requested_take_date) : null}, requested_take_date),
        approved_by          = COALESCE(${approved_by != null ? String(approved_by) : null}, approved_by),
        approval_date        = COALESCE(${approval_date != null ? String(approval_date) : null}, approval_date),
        actual_take_date     = COALESCE(${actual_take_date != null ? String(actual_take_date) : null}, actual_take_date),
        expected_return_date = COALESCE(${expected_return_date != null ? String(expected_return_date) : null}, expected_return_date),
        actual_return_date   = COALESCE(${actual_return_date != null ? String(actual_return_date) : null}, actual_return_date),
        status               = COALESCE(${status != null ? String(status) : null}, status),
        rejection_reason     = COALESCE(${rejection_reason != null ? String(rejection_reason) : null}, rejection_reason),
        purpose              = COALESCE(${purpose != null ? String(purpose) : null}, purpose),
        notes                = COALESCE(${notes != null ? String(notes) : null}, notes),
        updated_at           = NOW()
      WHERE id = ${id}
      RETURNING id, asset_id, requested_by, requester_email, requester_department,
                request_date, requested_take_date, approved_by, approval_date,
                actual_take_date, expected_return_date, actual_return_date,
                status, rejection_reason, purpose, notes, created_at, updated_at
    `) as Record<string, unknown>[];

    // Handle status changes
    if (status) {
      const newStatus = String(status);
      const assetId = asset_id ? String(asset_id) : currentRequest.asset_id;
      
      if (newStatus === 'Taken' && assetId) {
        // Mark asset as borrowed
        await sql`UPDATE assets SET status = 'Borrowed', updated_at = NOW() WHERE id = ${assetId}`;
      } else if (newStatus === 'Returned' && assetId) {
        // Mark asset as available again
        await sql`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = ${assetId}`;
      } else if (newStatus === 'Rejected' && assetId) {
        // If rejected and was previously taken, return asset to available
        if (currentRequest.status === 'Taken') {
          await sql`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = ${assetId}`;
        }
      }
    }
    
    if (!row) return json(res, 404, { error: 'Asset request not found' });
    return json(res, 200, row);
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  if (method === 'DELETE') {
    if (!requireRole(user.role, ['Admin'])) {
      return json(res, 403, { error: 'Forbidden' });
    }
    if (!id) return json(res, 400, { error: 'id query parameter is required' });

    // First check if the asset was borrowed and needs to be returned
    const [request] = (await sql`
      SELECT asset_id, status FROM asset_requests WHERE id = ${id}
    `) as Record<string, unknown>[];
    
    if (request && request.status === 'Taken') {
      // Return the asset to available
      await sql`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = ${request.asset_id}`;
    }
    
    await sql`DELETE FROM asset_requests WHERE id = ${id}`;
    return res.status(204).end();
  }

  return json(res, 405, { error: 'Method not allowed' });
}

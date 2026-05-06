/**
 * /api/assets
 *
 * GET    /api/assets              → list all assets
 * POST   /api/assets              → create asset
 * PUT    /api/assets?id=<id>      → update asset
 * DELETE /api/assets?id=<id>      → delete asset
 *
 * /api/assets/requests                → list all asset requests
 * POST   /api/assets/requests         → create asset request
 * PUT    /api/assets/requests?id=<id> → update asset request
 * DELETE /api/assets/requests?id=<id> → delete asset request
 *
 * Table DDL lives in migrations/ASSETS_TABLE_MIGRATION.sql — run it once per env.
 */

import type { ApiRequest, ApiResponse } from './_types.js';
import { sql } from './_db.js';
import {
  AuthenticatedRequest,
  verifyToken,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  handleCors,
  apiError,
} from './_middleware.js';
import { logAuditEvent } from './_audit.js';
import {
  AssetSchema,
  AssetUpdateSchema,
  AssetRequestSchema,
  AssetRequestUpdateSchema,
} from './_schemas.js';

function json(res: ApiResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;

  const { method, query } = req;
  const id = typeof query.id === 'string' ? query.id : undefined;

  const path = req.url || '';
  const isRequestsEndpoint = path.includes('/requests');

  try {
    if (isRequestsEndpoint) {
      return await handleAssetRequests(authReq, res, method, id);
    }

    // ── ASSETS ─────────────────────────────────────────────────────────────
    if (method === 'GET') {
      if (!requireAccessRole(authReq, res, ['super_admin', 'admin', 'user'])) return;
      const rows = await sql`
        SELECT id, name, description, category, serial_number, status,
               location, purchase_date, purchase_value, condition, created_at, updated_at
        FROM assets
        ORDER BY created_at DESC
      `;
      return json(res, 200, rows);
    }

    if (method === 'POST') {
      if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
      return await createAsset(authReq, res);
    }

    if (method === 'PUT') {
      if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
      if (!id) return json(res, 400, { error: 'id query parameter is required' });
      return await updateAsset(authReq, res, id);
    }

    if (method === 'DELETE') {
      if (!requireAccessRole(authReq, res, ['super_admin', 'admin'])) return;
      if (!id) return json(res, 400, { error: 'id query parameter is required' });
      return await deleteAsset(authReq, res, id);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err: unknown) {
    apiError(res, 500, 'Internal server error', err);
  }
}

async function createAsset(req: AuthenticatedRequest, res: ApiResponse) {
  try {
    const data = AssetSchema.parse(req.body);
    const [row] = (await sql`
      INSERT INTO assets (
        name, description, category, serial_number, status, location,
        purchase_date, purchase_value, condition, created_at, updated_at
      )
      VALUES (
        ${data.name},
        ${data.description ?? null},
        ${data.category},
        ${data.serial_number ?? null},
        ${data.status},
        ${data.location ?? null},
        ${data.purchase_date ?? null},
        ${data.purchase_value ?? null},
        ${data.condition ?? 'Good'},
        NOW(),
        NOW()
      )
      RETURNING id, name, description, category, serial_number, status, location,
                purchase_date, purchase_value, condition, created_at, updated_at
    `) as Record<string, unknown>[];

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'asset.create',
      tableName: 'assets',
      recordId: String(row.id),
      newData: row,
    });

    return json(res, 201, row);
  } catch (error) {
    apiError(res, 400, 'Invalid asset data', error);
  }
}

async function updateAsset(req: AuthenticatedRequest, res: ApiResponse, id: string) {
  try {
    const data = AssetUpdateSchema.parse(req.body);

    const existing = (await sql`
      SELECT id, name, description, category, serial_number, status, location,
             purchase_date, purchase_value, condition, created_at, updated_at
      FROM assets WHERE id = ${id}
    `) as Record<string, unknown>[];

    if (existing.length === 0) {
      return json(res, 404, { error: 'Asset not found' });
    }

    const [row] = (await sql`
      UPDATE assets SET
        name            = COALESCE(${data.name ?? null}, name),
        description     = COALESCE(${data.description ?? null}, description),
        category        = COALESCE(${data.category ?? null}, category),
        serial_number   = COALESCE(${data.serial_number ?? null}, serial_number),
        status          = COALESCE(${data.status ?? null}, status),
        location        = COALESCE(${data.location ?? null}, location),
        purchase_date   = COALESCE(${data.purchase_date ?? null}, purchase_date),
        purchase_value  = COALESCE(${data.purchase_value ?? null}, purchase_value),
        condition       = COALESCE(${data.condition ?? null}, condition),
        updated_at      = NOW()
      WHERE id = ${id}
      RETURNING id, name, description, category, serial_number, status, location,
                purchase_date, purchase_value, condition, created_at, updated_at
    `) as Record<string, unknown>[];

    if (!row) return json(res, 404, { error: 'Asset not found' });

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'asset.update',
      tableName: 'assets',
      recordId: String(id),
      oldData: existing[0],
      newData: row,
    });

    return json(res, 200, row);
  } catch (error) {
    apiError(res, 400, 'Invalid asset data', error);
  }
}

async function deleteAsset(req: AuthenticatedRequest, res: ApiResponse, id: string) {
  const existing = (await sql`
    SELECT id, name, description, category, serial_number, status, location,
           purchase_date, purchase_value, condition, created_at, updated_at
    FROM assets WHERE id = ${id}
  `) as Record<string, unknown>[];

  if (existing.length === 0) {
    return json(res, 404, { error: 'Asset not found' });
  }

  await sql`DELETE FROM assets WHERE id = ${id}`;

  await logAuditEvent({
    req,
    userId: req.user?.id,
    action: 'asset.delete',
    tableName: 'assets',
    recordId: String(id),
    oldData: existing[0],
  });

  return res.status(204).end();
}

// ─── Asset Request Handlers ─────────────────────────────────────────────────

async function handleAssetRequests(
  req: AuthenticatedRequest,
  res: ApiResponse,
  method: string | undefined,
  id?: string
) {
  if (method === 'GET') {
    if (!requireAccessRole(req, res, ['super_admin', 'admin', 'user'])) return;
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

  if (method === 'POST') {
    if (!requireAccessRole(req, res, ['super_admin', 'admin', 'user'])) return;
    try {
      const data = AssetRequestSchema.parse(req.body);
      const [row] = (await sql`
        INSERT INTO asset_requests (
          asset_id, requested_by, requester_email, requester_department,
          request_date, requested_take_date, approved_by, approval_date,
          actual_take_date, expected_return_date, actual_return_date,
          status, rejection_reason, purpose, notes, created_at, updated_at
        )
        VALUES (
          ${data.asset_id},
          ${data.requested_by},
          ${data.requester_email || null},
          ${data.requester_department ?? null},
          NOW(),
          ${data.requested_take_date ?? null},
          ${data.approved_by ?? null},
          ${data.approval_date ?? null},
          ${data.actual_take_date ?? null},
          ${data.expected_return_date ?? null},
          ${data.actual_return_date ?? null},
          ${data.status},
          ${data.rejection_reason ?? null},
          ${data.purpose ?? null},
          ${data.notes ?? null},
          NOW(),
          NOW()
        )
        RETURNING id, asset_id, requested_by, requester_email, requester_department,
                  request_date, requested_take_date, approved_by, approval_date,
                  actual_take_date, expected_return_date, actual_return_date,
                  status, rejection_reason, purpose, notes, created_at, updated_at
      `) as Record<string, unknown>[];

      if (data.status === 'Taken' && data.asset_id) {
        await sql`UPDATE assets SET status = 'Borrowed', updated_at = NOW() WHERE id = ${data.asset_id}`;
      }

      await logAuditEvent({
        req,
        userId: req.user?.id,
        action: 'asset_request.create',
        tableName: 'asset_requests',
        recordId: String(row.id),
        newData: row,
      });

      return json(res, 201, row);
    } catch (error) {
      apiError(res, 400, 'Invalid asset request data', error);
    }
    return;
  }

  if (method === 'PUT') {
    if (!requireAccessRole(req, res, ['super_admin', 'admin', 'user'])) return;
    if (!id) return json(res, 400, { error: 'id query parameter is required' });

    try {
      const data = AssetRequestUpdateSchema.parse(req.body);

      const [currentRequest] = (await sql`
        SELECT id, asset_id, requested_by, requester_email, requester_department,
               request_date, requested_take_date, approved_by, approval_date,
               actual_take_date, expected_return_date, actual_return_date,
               status, rejection_reason, purpose, notes, created_at, updated_at
        FROM asset_requests WHERE id = ${id}
      `) as Record<string, unknown>[];

      if (!currentRequest) {
        return json(res, 404, { error: 'Asset request not found' });
      }

      const [row] = (await sql`
        UPDATE asset_requests SET
          asset_id             = COALESCE(${data.asset_id ?? null}, asset_id),
          requested_by         = COALESCE(${data.requested_by ?? null}, requested_by),
          requester_email      = COALESCE(${data.requester_email || null}, requester_email),
          requester_department = COALESCE(${data.requester_department ?? null}, requester_department),
          requested_take_date  = COALESCE(${data.requested_take_date ?? null}, requested_take_date),
          approved_by          = COALESCE(${data.approved_by ?? null}, approved_by),
          approval_date        = COALESCE(${data.approval_date ?? null}, approval_date),
          actual_take_date     = COALESCE(${data.actual_take_date ?? null}, actual_take_date),
          expected_return_date = COALESCE(${data.expected_return_date ?? null}, expected_return_date),
          actual_return_date   = COALESCE(${data.actual_return_date ?? null}, actual_return_date),
          status               = COALESCE(${data.status ?? null}, status),
          rejection_reason     = COALESCE(${data.rejection_reason ?? null}, rejection_reason),
          purpose              = COALESCE(${data.purpose ?? null}, purpose),
          notes                = COALESCE(${data.notes ?? null}, notes),
          updated_at           = NOW()
        WHERE id = ${id}
        RETURNING id, asset_id, requested_by, requester_email, requester_department,
                  request_date, requested_take_date, approved_by, approval_date,
                  actual_take_date, expected_return_date, actual_return_date,
                  status, rejection_reason, purpose, notes, created_at, updated_at
      `) as Record<string, unknown>[];

      if (data.status) {
        const newStatus = data.status;
        const assetId = data.asset_id || (currentRequest.asset_id as string);

        if (newStatus === 'Taken' && assetId) {
          await sql`UPDATE assets SET status = 'Borrowed', updated_at = NOW() WHERE id = ${assetId}`;
        } else if (newStatus === 'Returned' && assetId) {
          await sql`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = ${assetId}`;
        } else if (newStatus === 'Rejected' && assetId && currentRequest.status === 'Taken') {
          await sql`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = ${assetId}`;
        }
      }

      if (!row) return json(res, 404, { error: 'Asset request not found' });

      await logAuditEvent({
        req,
        userId: req.user?.id,
        action: 'asset_request.update',
        tableName: 'asset_requests',
        recordId: String(id),
        oldData: currentRequest,
        newData: row,
      });

      return json(res, 200, row);
    } catch (error) {
      apiError(res, 400, 'Invalid asset request data', error);
    }
    return;
  }

  if (method === 'DELETE') {
    if (!requireAccessRole(req, res, ['super_admin', 'admin'])) return;
    if (!id) return json(res, 400, { error: 'id query parameter is required' });

    const [request] = (await sql`
      SELECT id, asset_id, requested_by, status
      FROM asset_requests WHERE id = ${id}
    `) as Record<string, unknown>[];

    if (!request) {
      return json(res, 404, { error: 'Asset request not found' });
    }

    if (request.status === 'Taken') {
      await sql`UPDATE assets SET status = 'Available', updated_at = NOW() WHERE id = ${String(request.asset_id)}`;
    }

    await sql`DELETE FROM asset_requests WHERE id = ${id}`;

    await logAuditEvent({
      req,
      userId: req.user?.id,
      action: 'asset_request.delete',
      tableName: 'asset_requests',
      recordId: String(id),
      oldData: request,
    });

    return res.status(204).end();
  }

  return json(res, 405, { error: 'Method not allowed' });
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  setSecurityHeaders,
  verifyToken,
} from '../_middleware.js';
import { sql } from '../_db.js';
import { logAuditEvent } from '../_audit.js';

const TenantStatusSchema = z.enum(['pending', 'active', 'suspended']);

const CreateTenantSchema = z.object({
  name: z.string().min(2).max(120),
  status: TenantStatusSchema.optional().default('pending'),
});

const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: TenantStatusSchema.optional(),
});

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  try {
    switch (req.method) {
      case 'GET':
        return await listTenants(res);
      case 'POST':
        return await createTenant(authReq, res);
      case 'PUT':
        return await updateTenant(authReq, res);
      case 'DELETE':
        return await deleteTenant(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function listTenants(res: VercelResponse) {
  const rows = await sql`
    SELECT
      t.id,
      t.name,
      t.slug,
      t.status,
      t.created_at,
      t.updated_at,
      COUNT(u.id)::int AS user_count,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(u.status, '')) = 'pending')::int AS pending_users
    FROM tenants t
    LEFT JOIN user_profiles u ON u.tenant_id = t.id
    GROUP BY t.id, t.name, t.slug, t.status, t.created_at, t.updated_at
    ORDER BY t.created_at DESC
  `;

  return res.status(200).json(rows);
}

async function createTenant(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const payload = CreateTenantSchema.parse(req.body);
    const slugBase = toSlug(payload.name);
    const slug = `${slugBase || 'tenant'}-${Math.floor(Date.now() / 1000)}`;

    const rows = await sql`
      INSERT INTO tenants (name, slug, status)
      VALUES (${payload.name}, ${slug}, ${payload.status})
      RETURNING id, name, slug, status, created_at, updated_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'admin.tenants.created',
      tableName: 'tenants',
      recordId: rows[0].id,
      newData: rows[0],
    });

    return res.status(201).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid tenant payload', error);
  }
}

async function updateTenant(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const tenantId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!tenantId) return apiError(res, 400, 'Missing tenant id');

    const payload = UpdateTenantSchema.parse(req.body);
    if (!payload.name && !payload.status) return apiError(res, 400, 'No updates provided');

    let slug: string | null = null;
    if (payload.name) {
      const slugBase = toSlug(payload.name);
      slug = `${slugBase || 'tenant'}-${Math.floor(Date.now() / 1000)}`;
    }

    const rows = await sql`
      UPDATE tenants
      SET
        name = COALESCE(${payload.name || null}, name),
        slug = COALESCE(${slug}, slug),
        status = COALESCE(${payload.status || null}, status),
        updated_at = NOW()
      WHERE id = ${tenantId}::uuid
      RETURNING id, name, slug, status, created_at, updated_at
    `;

    if (rows.length === 0) return apiError(res, 404, 'Tenant not found');

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'admin.tenants.updated',
      tableName: 'tenants',
      recordId: rows[0].id,
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid tenant update payload', error);
  }
}

async function deleteTenant(req: AuthenticatedRequest, res: VercelResponse) {
  const tenantId = typeof req.query.id === 'string' ? req.query.id : '';
  if (!tenantId) return apiError(res, 400, 'Missing tenant id');

  const linkedUsers = await sql`
    SELECT COUNT(*) AS count
    FROM user_profiles
    WHERE tenant_id = ${tenantId}::uuid
  `;
  const count = parseInt(String(linkedUsers[0]?.count || '0'), 10);
  if (count > 0) {
    return apiError(res, 409, 'Cannot delete tenant with linked users');
  }

  const rows = await sql`
    DELETE FROM tenants
    WHERE id = ${tenantId}::uuid
    RETURNING id, name, slug, status
  `;
  if (rows.length === 0) return apiError(res, 404, 'Tenant not found');

  await logAuditEvent({
    req,
    userId: req.user?.id || null,
    action: 'admin.tenants.deleted',
    tableName: 'tenants',
    recordId: rows[0].id,
    oldData: rows[0],
  });

  return res.status(204).end();
}

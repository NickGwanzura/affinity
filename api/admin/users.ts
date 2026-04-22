import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import {
  AuthenticatedRequest,
  apiError,
  handleCors,
  requireAccessRole,
  requirePasswordCurrent,
  setSecurityHeaders,
  verifyToken,
} from '../_middleware.js';
import { sql } from '../_db.js';
import { logAuditEvent } from '../_audit.js';

const AccessRoleSchema = z.enum(['super_admin', 'admin', 'user']);
const UserStatusSchema = z.enum(['Active', 'Inactive', 'Pending']);

const UpdateUserSchema = z.object({
  role: z.string().min(1).optional(),
  accessRole: AccessRoleSchema.optional(),
  status: UserStatusSchema.optional(),
});

const SetAccessRoleSchema = z.object({
  userId: z.string().uuid(),
  accessRole: AccessRoleSchema,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);
  if (handleCors(req, res)) return;

  const authReq = req as AuthenticatedRequest;
  if (!(await verifyToken(authReq, res))) return;
  if (!requirePasswordCurrent(authReq, res)) return;
  if (!requireAccessRole(authReq, res, ['super_admin'])) return;

  try {
    const action = typeof req.query.action === 'string' ? req.query.action : '';
    if (req.method === 'POST' && action === 'set-access-role') {
      return await setAccessRole(authReq, res);
    }

    switch (req.method) {
      case 'GET':
        return await listUsers(req, res);
      case 'PUT':
      case 'PATCH':
        return await updateUser(authReq, res);
      default:
        return apiError(res, 405, 'Method not allowed');
    }
  } catch (error) {
    return apiError(res, 500, 'Internal server error', error);
  }
}

async function setAccessRole(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const { userId, accessRole } = SetAccessRoleSchema.parse(req.body);

    const existingRows = await sql`
      SELECT id, email, access_role
      FROM user_profiles
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;
    if (existingRows.length === 0) return apiError(res, 404, 'User not found');

    // Guardrail: refuse to demote the last super_admin.
    if (existingRows[0].access_role === 'super_admin' && accessRole !== 'super_admin') {
      const counts = await sql`
        SELECT COUNT(*)::int AS n
        FROM user_profiles
        WHERE access_role = 'super_admin'
      `;
      if ((counts[0]?.n ?? 0) <= 1) {
        return apiError(res, 400, 'Cannot demote the last super_admin');
      }
    }

    const rows = await sql`
      UPDATE user_profiles
      SET access_role = ${accessRole}, updated_at = NOW()
      WHERE id = ${userId}::uuid
      RETURNING id, name, email, role, access_role, status, created_at, updated_at
    `;

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'admin.users.access_role_set',
      tableName: 'user_profiles',
      recordId: userId,
      oldData: existingRows[0],
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid set-access-role payload', error);
  }
}

async function listUsers(req: VercelRequest, res: VercelResponse) {
  const status = typeof req.query.status === 'string' ? req.query.status : '';

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    clauses.push(`LOWER(COALESCE(u.status, '')) = LOWER($${params.length})`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const query = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.access_role,
      u.status,
      u.created_at
    FROM user_profiles u
    ${whereClause}
    ORDER BY u.created_at DESC
  `;

  const result = await sql.query(query, params);
  return res.status(200).json(result.rows ?? result);
}

async function updateUser(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = typeof req.query.id === 'string' ? req.query.id : '';
    if (!userId) return apiError(res, 400, 'Missing user id');

    const payload = UpdateUserSchema.parse(req.body);
    if (!payload.role && !payload.accessRole && !payload.status) {
      return apiError(res, 400, 'No updates provided');
    }

    const existingRows = await sql`
      SELECT id, role, access_role, status
      FROM user_profiles
      WHERE id = ${userId}::uuid
      LIMIT 1
    `;
    if (existingRows.length === 0) return apiError(res, 404, 'User not found');

    const rows = await sql`
      UPDATE user_profiles
      SET
        role = COALESCE(${payload.role || null}, role),
        access_role = COALESCE(${payload.accessRole || null}, access_role),
        status = COALESCE(${payload.status || null}, status),
        updated_at = NOW()
      WHERE id = ${userId}::uuid
      RETURNING id, name, email, role, access_role, status, created_at, updated_at
    `;
    if (rows.length === 0) return apiError(res, 404, 'User not found');

    await logAuditEvent({
      req,
      userId: req.user?.id || null,
      action: 'admin.users.updated',
      tableName: 'user_profiles',
      recordId: userId,
      oldData: existingRows[0],
      newData: rows[0],
    });

    return res.status(200).json(rows[0]);
  } catch (error) {
    return apiError(res, 400, 'Invalid user update payload', error);
  }
}
